import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

st.set_page_config(page_title="Housing Price Prediction Dashboard", layout="wide")

# ---------- Load data ----------
@st.cache_data
def load_data():
    df = pd.read_csv("output.csv")
    return df

df = load_data()

st.title("🏠 Housing Price Prediction Dashboard")
st.caption("Actual vs Predicted median house values")

# ---------- Sidebar filters ----------
st.sidebar.header("Filters")

if "ocean_proximity" in df.columns:
    proximity_options = df["ocean_proximity"].unique().tolist()
    selected_proximity = st.sidebar.multiselect(
        "Ocean Proximity", proximity_options, default=proximity_options
    )
    df = df[df["ocean_proximity"].isin(selected_proximity)]

price_min, price_max = int(df["median_house_value"].min()), int(df["median_house_value"].max())
price_range = st.sidebar.slider(
    "Actual Price Range", price_min, price_max, (price_min, price_max)
)
df = df[
    (df["median_house_value"] >= price_range[0]) &
    (df["median_house_value"] <= price_range[1])
]

st.sidebar.write(f"Showing **{len(df)}** rows after filters")

# ---------- KPIs ----------
y_actual = df["median_house_value"]
y_pred = df["predicted_house_value"]

mae = mean_absolute_error(y_actual, y_pred)
rmse = np.sqrt(mean_squared_error(y_actual, y_pred))
r2 = r2_score(y_actual, y_pred)

col1, col2, col3 = st.columns(3)
col1.metric("MAE", f"${mae:,.0f}")
col2.metric("RMSE", f"${rmse:,.0f}")
col3.metric("R² Score", f"{r2:.3f}")

st.divider()

# ---------- Actual vs Predicted scatter ----------
st.subheader("Actual vs Predicted")
fig_scatter = px.scatter(
    df, x="median_house_value", y="predicted_house_value",
    color="abs_error" if "abs_error" in df.columns else None,
    color_continuous_scale="Reds",
    opacity=0.6,
    labels={"median_house_value": "Actual", "predicted_house_value": "Predicted"},
)
min_val = min(y_actual.min(), y_pred.min())
max_val = max(y_actual.max(), y_pred.max())
fig_scatter.add_shape(
    type="line", x0=min_val, y0=min_val, x1=max_val, y1=max_val,
    line=dict(color="black", dash="dash")
)
st.plotly_chart(fig_scatter, use_container_width='Stretch')

# ---------- Residual plot ----------
st.subheader("Residuals (Predicted vs Error)")
df["error"] = y_pred - y_actual
fig_resid = px.scatter(
    df, x="predicted_house_value", y="error",
    opacity=0.6,
    labels={"predicted_house_value": "Predicted", "error": "Error (Pred - Actual)"},
)
fig_resid.add_hline(y=0, line_dash="dash", line_color="black")
st.plotly_chart(fig_resid, use_container_width='Stretch')

# ---------- Error distribution ----------
st.subheader("Error Distribution")
fig_hist = px.histogram(df, x="error", nbins=50)
st.plotly_chart(fig_hist, use_container_width='Stretch')

# ---------- Geo map ----------
if "latitude" in df.columns and "longitude" in df.columns:
    st.subheader("Prediction Error by Location")
    fig_map = px.scatter_map(
        df, lat="latitude", lon="longitude",
        color="abs_error" if "abs_error" in df.columns else "error",
        color_continuous_scale="Reds",
        size_max=10, zoom=5,
        map_style="carto-positron",
        hover_data=["median_house_value", "predicted_house_value"],
    )
    st.plotly_chart(fig_map, use_container_width='Stretch')

# ---------- Worst predictions table ----------
st.subheader("Top 20 Worst Predictions")
if "abs_error" in df.columns:
    worst = df.sort_values("abs_error", ascending=False).head(20)
else:
    worst = df.reindex(df["error"].abs().sort_values(ascending=False).index).head(20)
st.dataframe(worst, use_container_width='Stretch')

# ---------- Raw data ----------
with st.expander("View raw output.csv data"):
    st.dataframe(df, use_container_width='Stretch')