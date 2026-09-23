# Pratyaksh's California Housing Predictor

A machine learning web application built with **Flask**, **scikit-learn**, and a minimal **Comic Black & White** aesthetic. Predicts median house values across California using a trained Random Forest Regressor and features three core modules:

1. **Single House Predictor**: Real-time valuation calculator with instant presets, custom inputs, and computed housing block ratios.
2. **Batch Inference**: Mass valuation via CSV file upload (with drag-and-drop), instant evaluation of preloaded test data, summary metrics, paginated preview table, and enriched CSV export.
3. **Training & Evaluation Intel Dashboard**: Evaluates model performance against the 4,128 test records with interactive geographic filters, price range slider, residual distributions, and monochrome charts.

---

## Project Structure

```
├── app.py                  # Flask server & REST API backend
├── main.py                 # Model training and data preparation pipeline
├── templates/
│   └── index.html          # Comic-styled single page application (3 tabs)
├── static/
│   ├── css/
│   │   └── style.css       # Monochromatic styling, halftone screentones, comic panels
│   └── js/
│       └── app.js          # Client AJAX predictor, file upload, & Chart.js engine
├── model.pkl               # Trained RandomForestRegressor model
├── pipeline.pkl            # Preprocessing ColumnTransformer pipeline
├── housing.csv             # Full California housing dataset (20,640 records)
├── input.csv               # Stratified test set features
├── output.csv              # Test set evaluation benchmark results
└── requirements.txt        # Python dependencies
```

---

## How to Run

### 1. Set Up Virtual Environment

```bash
# Activate existing virtual environment
venv\Scripts\activate
```

*(Or create a new one if needed: `python -m venv venv && venv\Scripts\activate`)*

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Launch Application

```bash
python app.py
```

### 4. Open in Browser

Navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## Application Modules

### 01. Single Predictor
- **Inputs**: Longitude, Latitude, Housing Median Age, Total Rooms, Total Bedrooms, Population, Households, Median Income, and Ocean Proximity.
- **Quick Presets**: 1-click test scenarios for *Bay Area (Berkeley)*, *LA Coast (Santa Monica)*, *Central Valley (Fresno)*, and *San Diego Suburb*.
- **Verdict Output**: Speech bubble displaying predicted price along with calculated block ratios (*Rooms/Household*, *Bedrooms/Room*, *People/Household*, and *Est. Annual Income*).

### 02. Batch Inference
- Drag-and-drop or browse any `.csv` file containing the required California features.
- Download a ready-to-use sample CSV template via **"Download Sample CSV Template"**.
- One-click instant run on the preloaded test set (4,128 rows).
- Summary KPIs (*Total Records*, *Mean Valuation*, *Valuation Range*, and *MAE / RMSE / R²* if ground truth labels are provided).
- Download full prediction outputs as an enriched CSV.

### 03. Training Intel Dashboard
- **Model Evaluation KPIs**: Mean Absolute Error (MAE: ~$30.9K), Root Mean Squared Error (RMSE: ~$47.2K), and R² Score (0.83).
- **Interactive Filters**: Ocean proximity chips (`ALL`, `<1H OCEAN`, `INLAND`, `NEAR OCEAN`, `NEAR BAY`, `ISLAND`) and price threshold slider.
- **Monochrome Charts**:
  - *Figure 01*: Actual vs. Predicted scatter plot with $y = x$ parity reference line.
  - *Figure 02*: Residual / Error distribution histogram.
  - *Figure 03*: Regional comparison of Actual vs. Predicted mean values across ocean categories.
- **Outlier Analysis**: Top 15 worst predictions table with absolute error and percentage error breakdown.

---

## REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Serves the web interface |
| `/api/predict` | `POST` | Single house prediction (JSON in, prediction + ratios out) |
| `/api/batch-predict` | `POST` | Batch prediction via CSV file upload or preloaded test set |
| `/api/download-batch/<batch_id>` | `GET` | Downloads batch output as CSV |
| `/api/sample-csv` | `GET` | Downloads sample input CSV template |
| `/api/dashboard-data` | `GET` | Filtered evaluation metrics and chart data |
| `/api/model-info` | `GET` | Model hyperparameters and pipeline metadata |

---

## Machine Learning Details

- **Model**: `RandomForestRegressor(random_state=42)`
- **Preprocessing Pipeline**:
  - Numerical: `SimpleImputer(strategy="median")` &rarr; `StandardScaler()`
  - Categorical (`ocean_proximity`): `OneHotEncoder(handle_unknown="ignore")`
- **Data Splitting**: Stratified shuffle split based on income categories (`income_cat`) with an 80/20 train/test ratio.