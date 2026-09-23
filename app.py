import os
import io
import uuid
import warnings
import pandas as pd
import numpy as np
import joblib
from flask import Flask, render_template, request, jsonify, Response
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Suppress scikit-learn unpickle version warnings for clean logs
warnings.filterwarnings("ignore", category=UserWarning)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max file size

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(BASE_DIR, "model.pkl")
PIPELINE_FILE = os.path.join(BASE_DIR, "pipeline.pkl")
HOUSING_FILE = os.path.join(BASE_DIR, "housing.csv")
INPUT_FILE = os.path.join(BASE_DIR, "input.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "output.csv")

# Global caches
model = None
pipeline = None
output_df_cache = None
batch_cache = {}  # In-memory storage for batch prediction results

FEATURE_COLUMNS = [
    "longitude",
    "latitude",
    "housing_median_age",
    "total_rooms",
    "total_bedrooms",
    "population",
    "households",
    "median_income",
    "ocean_proximity"
]

NUMERIC_COLUMNS = [
    "longitude",
    "latitude",
    "housing_median_age",
    "total_rooms",
    "total_bedrooms",
    "population",
    "households",
    "median_income"
]

OCEAN_PROXIMITY_OPTIONS = ["<1H OCEAN", "INLAND", "ISLAND", "NEAR BAY", "NEAR OCEAN"]


def load_artifacts():
    global model, pipeline, output_df_cache
    if model is None and os.path.exists(MODEL_FILE):
        model = joblib.load(MODEL_FILE)
    if pipeline is None and os.path.exists(PIPELINE_FILE):
        pipeline = joblib.load(PIPELINE_FILE)
    if output_df_cache is None and os.path.exists(OUTPUT_FILE):
        output_df_cache = pd.read_csv(OUTPUT_FILE)


# Ensure artifacts are loaded at boot
load_artifacts()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/predict", methods=["POST"])
def predict_single():
    load_artifacts()
    if model is None or pipeline is None:
        return jsonify({"error": "Model or pipeline artifact not found."}), 500

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload."}), 400

    try:
        # Validate and construct feature dictionary
        row = {}
        for col in NUMERIC_COLUMNS:
            if col not in data or data[col] is None or data[col] == "":
                return jsonify({"error": f"Missing required numerical field: '{col}'"}), 400
            row[col] = [float(data[col])]

        ocean_prox = str(data.get("ocean_proximity", "")).strip().upper()
        if ocean_prox not in OCEAN_PROXIMITY_OPTIONS:
            return jsonify({
                "error": f"Invalid ocean_proximity '{ocean_prox}'. Must be one of: {OCEAN_PROXIMITY_OPTIONS}"
            }), 400
        row["ocean_proximity"] = [ocean_prox]

        input_df = pd.DataFrame(row)
        transformed = pipeline.transform(input_df)
        prediction = float(model.predict(transformed)[0])

        # Calculate useful secondary real estate metrics
        households = max(row["households"][0], 1)
        total_rooms = max(row["total_rooms"][0], 1)
        total_bedrooms = max(row["total_bedrooms"][0], 0)
        population = max(row["population"][0], 0)

        rooms_per_household = round(total_rooms / households, 2)
        bedrooms_per_room = round(total_bedrooms / total_rooms, 3)
        population_per_household = round(population / households, 2)

        return jsonify({
            "success": True,
            "predicted_price": round(prediction, 2),
            "formatted_price": f"${prediction:,.0f}",
            "ratios": {
                "rooms_per_household": rooms_per_household,
                "bedrooms_per_room": bedrooms_per_room,
                "population_per_household": population_per_household
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/batch-predict", methods=["POST"])
def batch_predict():
    load_artifacts()
    if model is None or pipeline is None:
        return jsonify({"error": "Model or pipeline artifact not found."}), 500

    try:
        use_preloaded = request.form.get("use_preloaded", "false").lower() == "true"
        df = None

        if use_preloaded:
            if not os.path.exists(INPUT_FILE):
                return jsonify({"error": "Preloaded input.csv file not found on server."}), 404
            df = pd.read_csv(INPUT_FILE)
        else:
            if "file" not in request.files:
                return jsonify({"error": "No file uploaded. Please upload a CSV file."}), 400
            file = request.files["file"]
            if file.filename == "":
                return jsonify({"error": "No file selected."}), 400
            if not file.filename.lower().endswith(".csv"):
                return jsonify({"error": "Invalid file type. Please upload a .csv file."}), 400
            
            # Read CSV from memory
            stream = io.StringIO(file.stream.read().decode("utf-8", errors="replace"))
            df = pd.read_csv(stream)

        if df is None or df.empty:
            return jsonify({"error": "The uploaded CSV file is empty."}), 400

        # Check required columns
        missing_cols = [col for col in FEATURE_COLUMNS if col not in df.columns]
        if missing_cols:
            return jsonify({
                "error": f"Missing required columns in CSV: {missing_cols}. Required: {FEATURE_COLUMNS}"
            }), 400

        has_actuals = "median_house_value" in df.columns
        features = df[FEATURE_COLUMNS].copy()

        # Handle numeric types cleanly
        for col in NUMERIC_COLUMNS:
            features[col] = pd.to_numeric(features[col], errors="coerce")

        transformed = pipeline.transform(features)
        predictions = model.predict(transformed)

        # Build output dataframe
        result_df = df.copy()
        result_df["predicted_house_value"] = np.round(predictions, 2)

        metrics = {}
        if has_actuals:
            # Drop NaN actuals for metric calculations if any
            valid_mask = ~result_df["median_house_value"].isna()
            if valid_mask.sum() > 0:
                y_act = result_df.loc[valid_mask, "median_house_value"]
                y_pred = result_df.loc[valid_mask, "predicted_house_value"]
                mae = float(mean_absolute_error(y_act, y_pred))
                rmse = float(np.sqrt(mean_squared_error(y_act, y_pred)))
                r2 = float(r2_score(y_act, y_pred))
                
                result_df["abs_error"] = np.round((y_act - y_pred).abs(), 2)
                result_df["pct_error"] = np.round((result_df["abs_error"] / y_act) * 100, 2)
                
                metrics = {
                    "has_actuals": True,
                    "mae": round(mae, 2),
                    "formatted_mae": f"${mae:,.0f}",
                    "rmse": round(rmse, 2),
                    "formatted_rmse": f"${rmse:,.0f}",
                    "r2": round(r2, 4)
                }
            else:
                metrics = {"has_actuals": False}
        else:
            metrics = {"has_actuals": False}

        # Overall summary stats
        total_rows = len(result_df)
        mean_price = float(result_df["predicted_house_value"].mean())
        min_price = float(result_df["predicted_house_value"].min())
        max_price = float(result_df["predicted_house_value"].max())

        # Generate batch ID and store in memory cache
        batch_id = str(uuid.uuid4())
        batch_cache[batch_id] = result_df

        # Clean cache if it gets too large
        if len(batch_cache) > 20:
            oldest_key = next(iter(batch_cache))
            del batch_cache[oldest_key]

        # Prepare first 50 rows preview
        preview_cols = [
            c for c in [
                "longitude", "latitude", "housing_median_age", "total_rooms",
                "median_income", "ocean_proximity", "median_house_value",
                "predicted_house_value", "abs_error", "pct_error"
            ] if c in result_df.columns
        ]
        preview_data = result_df[preview_cols].head(50).to_dict(orient="records")

        return jsonify({
            "success": True,
            "batch_id": batch_id,
            "total_rows": total_rows,
            "summary": {
                "total_rows": total_rows,
                "mean_price": round(mean_price, 2),
                "formatted_mean_price": f"${mean_price:,.0f}",
                "min_price": round(min_price, 2),
                "formatted_min_price": f"${min_price:,.0f}",
                "max_price": round(max_price, 2),
                "formatted_max_price": f"${max_price:,.0f}",
                **metrics
            },
            "columns": preview_cols,
            "preview": preview_data
        })
    except Exception as e:
        return jsonify({"error": f"Batch prediction failed: {str(e)}"}), 500


@app.route("/api/download-batch/<batch_id>")
def download_batch(batch_id):
    if batch_id not in batch_cache:
        return jsonify({"error": "Batch expired or not found. Please re-run the prediction."}), 404
    
    result_df = batch_cache[batch_id]
    csv_data = result_df.to_csv(index=False)
    
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=california_predictions_{batch_id[:8]}.csv"}
    )


@app.route("/api/sample-csv")
def sample_csv():
    # Return a 5-row ready-to-test CSV with the required columns
    sample_data = """longitude,latitude,housing_median_age,total_rooms,total_bedrooms,population,households,median_income,ocean_proximity
-122.23,37.88,41.0,880.0,129.0,322.0,126.0,8.3252,NEAR BAY
-118.39,34.12,29.0,6447.0,1012.0,2184.0,960.0,8.2816,<1H OCEAN
-120.42,34.89,24.0,2020.0,307.0,855.0,283.0,5.0099,<1H OCEAN
-119.78,36.75,37.0,1832.0,398.0,921.0,366.0,2.1528,INLAND
-121.96,36.60,46.0,2171.0,432.0,877.0,389.0,3.9875,NEAR OCEAN
"""
    return Response(
        sample_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=california_housing_sample.csv"}
    )


@app.route("/api/dashboard-data")
def dashboard_data():
    load_artifacts()
    global output_df_cache
    if output_df_cache is None:
        if os.path.exists(OUTPUT_FILE):
            output_df_cache = pd.read_csv(OUTPUT_FILE)
        else:
            return jsonify({"error": "output.csv evaluation file not found."}), 404

    df = output_df_cache.copy()

    # Filter by ocean proximity
    selected_proximity = request.args.get("ocean_proximity", "ALL")
    if selected_proximity and selected_proximity != "ALL":
        proximities = [p.strip() for p in selected_proximity.split(",") if p.strip()]
        if proximities:
            df = df[df["ocean_proximity"].isin(proximities)]

    # Filter by actual price range
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)
    if min_price is not None:
        df = df[df["median_house_value"] >= min_price]
    if max_price is not None:
        df = df[df["median_house_value"] <= max_price]

    total_filtered = len(df)
    if total_filtered == 0:
        return jsonify({
            "total_rows": 0,
            "metrics": {"mae": 0, "rmse": 0, "r2": 0},
            "scatter": [],
            "error_hist": {"bins": [], "counts": []},
            "ocean_breakdown": [],
            "worst_predictions": []
        })

    y_actual = df["median_house_value"]
    y_pred = df["predicted_house_value"]

    mae = float(mean_absolute_error(y_actual, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_actual, y_pred)))
    r2 = float(r2_score(y_actual, y_pred)) if total_filtered > 1 else 0.0

    # Ensure abs_error and error exist
    if "abs_error" not in df.columns:
        df["abs_error"] = (y_actual - y_pred).abs()
    df["error"] = y_pred - y_actual

    # Sample for scatter plot (up to 400 points evenly distributed to render fast and clean)
    sample_size = min(400, total_filtered)
    scatter_sample = df.sample(n=sample_size, random_state=42) if total_filtered > sample_size else df
    scatter_data = [
        {
            "x": round(float(row["median_house_value"]), 0),
            "y": round(float(row["predicted_house_value"]), 0),
            "err": round(float(row["abs_error"]), 0)
        }
        for _, row in scatter_sample.iterrows()
    ]

    # Error Histogram (20 bins)
    errors = df["error"].dropna()
    counts, bin_edges = np.histogram(errors, bins=20)
    bin_labels = [f"${int(bin_edges[i]/1000)}k" for i in range(len(counts))]
    hist_data = {
        "labels": bin_labels,
        "counts": counts.tolist()
    }

    # Ocean Proximity comparison
    grouped = df.groupby("ocean_proximity").agg(
        avg_actual=("median_house_value", "mean"),
        avg_predicted=("predicted_house_value", "mean"),
        count=("median_house_value", "count")
    ).reset_index()

    ocean_breakdown = [
        {
            "proximity": row["ocean_proximity"],
            "avg_actual": round(float(row["avg_actual"]), 0),
            "avg_predicted": round(float(row["avg_predicted"]), 0),
            "count": int(row["count"])
        }
        for _, row in grouped.iterrows()
    ]

    # Top 15 Worst Predictions
    worst_df = df.sort_values("abs_error", ascending=False).head(15)
    worst_predictions = [
        {
            "longitude": float(r["longitude"]),
            "latitude": float(r["latitude"]),
            "median_income": round(float(r["median_income"]), 2),
            "ocean_proximity": str(r["ocean_proximity"]),
            "actual": round(float(r["median_house_value"]), 0),
            "predicted": round(float(r["predicted_house_value"]), 0),
            "abs_error": round(float(r["abs_error"]), 0),
            "pct_error": round(float(r.get("pct_error", (r["abs_error"]/r["median_house_value"])*100)), 1)
        }
        for _, r in worst_df.iterrows()
    ]

    # Global baseline range for price slider initialization
    orig_df = output_df_cache
    min_actual_global = float(orig_df["median_house_value"].min())
    max_actual_global = float(orig_df["median_house_value"].max())

    return jsonify({
        "total_rows": total_filtered,
        "global_min_price": min_actual_global,
        "global_max_price": max_actual_global,
        "metrics": {
            "mae": round(mae, 0),
            "formatted_mae": f"${mae:,.0f}",
            "rmse": round(rmse, 0),
            "formatted_rmse": f"${rmse:,.0f}",
            "r2": round(r2, 3),
            "avg_actual": f"${y_actual.mean():,.0f}",
            "avg_predicted": f"${y_pred.mean():,.0f}"
        },
        "scatter": scatter_data,
        "error_hist": hist_data,
        "ocean_breakdown": ocean_breakdown,
        "worst_predictions": worst_predictions
    })


@app.route("/api/model-info")
def model_info():
    return jsonify({
        "model_name": "Random Forest Regressor",
        "algorithm": "sklearn.ensemble.RandomForestRegressor",
        "n_features": len(FEATURE_COLUMNS),
        "features": FEATURE_COLUMNS,
        "training_samples": 16512,
        "test_samples": 4130,
        "preprocessing": "SimpleImputer(median) -> StandardScaler + OneHotEncoder"
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"California Housing Predictor running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
