/**
 * CALIFORNIA HOUSING PREDICTOR // FRONTEND ENGINE
 * Comic Black & White Architecture
 */

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSinglePredictor();
    initBatchPredictor();
    initDashboard();
});

/* ==========================================================================
   01. TABS SYSTEM
   ========================================================================== */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // Lazy initialize / resize charts when opening dashboard tab
            if (targetId === 'dashboard-section') {
                if (!window.dashboardLoaded) {
                    loadDashboardData();
                } else {
                    resizeAllCharts();
                }
            }
        });
    });
}

/* ==========================================================================
   02. SINGLE PREDICTOR MODULE
   ========================================================================== */
const PRESETS = {
    bay: {
        longitude: -122.23,
        latitude: 37.88,
        housing_median_age: 41,
        total_rooms: 880,
        total_bedrooms: 129,
        population: 322,
        households: 126,
        median_income: 8.3252,
        ocean_proximity: 'NEAR BAY',
        desc: 'Berkeley Hills / San Francisco Bay Area. High income coastal zone.'
    },
    la: {
        longitude: -118.49,
        latitude: 34.01,
        housing_median_age: 35,
        total_rooms: 2400,
        total_bedrooms: 480,
        population: 1100,
        households: 450,
        median_income: 6.25,
        ocean_proximity: '<1H OCEAN',
        desc: 'Santa Monica / West Los Angeles metro. Strong residential density.'
    },
    inland: {
        longitude: -119.78,
        latitude: 36.75,
        housing_median_age: 37,
        total_rooms: 1832,
        total_bedrooms: 398,
        population: 921,
        households: 366,
        median_income: 2.1528,
        ocean_proximity: 'INLAND',
        desc: 'Fresno / Central Valley rural agricultural basin. Lower valuation bracket.'
    },
    sd: {
        longitude: -117.15,
        latitude: 32.75,
        housing_median_age: 28,
        total_rooms: 3200,
        total_bedrooms: 610,
        population: 1450,
        households: 580,
        median_income: 5.12,
        ocean_proximity: 'NEAR OCEAN',
        desc: 'San Diego Coastal Suburb. Moderate-high demand shoreline corridor.'
    }
};

function initSinglePredictor() {
    const form = document.getElementById('single-predict-form');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const resetBtn = document.getElementById('btn-reset-single');

    // Preset handlers
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-preset');
            const data = PRESETS[key];
            if (!data) return;

            document.getElementById('longitude').value = data.longitude;
            document.getElementById('latitude').value = data.latitude;
            document.getElementById('housing_median_age').value = data.housing_median_age;
            document.getElementById('total_rooms').value = data.total_rooms;
            document.getElementById('total_bedrooms').value = data.total_bedrooms;
            document.getElementById('population').value = data.population;
            document.getElementById('households').value = data.households;
            document.getElementById('median_income').value = data.median_income;
            document.getElementById('ocean_proximity').value = data.ocean_proximity;

            // Trigger prediction immediately on preset click
            submitSinglePrediction();
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('longitude').value = -122.23;
            document.getElementById('latitude').value = 37.88;
            document.getElementById('housing_median_age').value = 41;
            document.getElementById('total_rooms').value = 880;
            document.getElementById('total_bedrooms').value = 129;
            document.getElementById('population').value = 322;
            document.getElementById('households').value = 126;
            document.getElementById('median_income').value = 8.3252;
            document.getElementById('ocean_proximity').value = 'NEAR BAY';
            submitSinglePrediction();
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitSinglePrediction();
    });

    // Auto-predict default on load
    submitSinglePrediction();
}

async function submitSinglePrediction() {
    const btn = document.getElementById('btn-predict');
    const outputPrice = document.getElementById('single-price-output');
    const verdictText = document.getElementById('single-verdict-text');
    const bubble = document.getElementById('speech-bubble');

    const payload = {
        longitude: parseFloat(document.getElementById('longitude').value),
        latitude: parseFloat(document.getElementById('latitude').value),
        housing_median_age: parseFloat(document.getElementById('housing_median_age').value),
        total_rooms: parseFloat(document.getElementById('total_rooms').value),
        total_bedrooms: parseFloat(document.getElementById('total_bedrooms').value),
        population: parseFloat(document.getElementById('population').value),
        households: parseFloat(document.getElementById('households').value),
        median_income: parseFloat(document.getElementById('median_income').value),
        ocean_proximity: document.getElementById('ocean_proximity').value
    };

    // Quick client-side check
    for (let k in payload) {
        if (payload[k] === null || isNaN(payload[k]) && k !== 'ocean_proximity') {
            alert(`Please provide a valid numeric value for ${k}`);
            return;
        }
    }

    btn.disabled = true;
    outputPrice.textContent = 'CALCULATING...';

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (res.success) {
            outputPrice.textContent = res.formatted_price;

            // Update block ratios
            if (res.ratios) {
                document.getElementById('ratio-rooms').textContent = res.ratios.rooms_per_household;
                document.getElementById('ratio-bedrooms').textContent = res.ratios.bedrooms_per_room;
                document.getElementById('ratio-population').textContent = res.ratios.population_per_household;
            }

            const incomeUsd = Math.round(payload.median_income * 10000);
            document.getElementById('display-income-usd').textContent = `$${incomeUsd.toLocaleString()}`;

            // Update GPS info
            document.getElementById('coords-display').textContent = `LAT ${payload.latitude.toFixed(2)}° N • LON ${payload.longitude.toFixed(2)}° W`;
            
            // Comic dynamic commentary
            let verdict = '';
            if (res.predicted_price > 350000) {
                verdict = `High-tier coastal zone. Model reflects premium valuation for ${payload.ocean_proximity}.`;
            } else if (res.predicted_price > 180000) {
                verdict = `Mid-tier California suburban district. Balanced density with ${res.ratios.rooms_per_household} rooms/house.`;
            } else {
                verdict = `Affordable regional tier. Typically inland corridor with moderate household income.`;
            }
            verdictText.textContent = verdict;

            // Comic pop animation
            bubble.classList.remove('pop-anim');
            void bubble.offsetWidth; // trigger reflow
            bubble.classList.add('pop-anim');
        } else {
            outputPrice.textContent = 'ERROR';
            verdictText.textContent = res.error || 'Failed to compute prediction.';
        }
    } catch (err) {
        outputPrice.textContent = 'OFFLINE';
        verdictText.textContent = `Server connection error: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
}

/* ==========================================================================
   03. BATCH INFERENCE MODULE
   ========================================================================== */
function initBatchPredictor() {
    const dropzone = document.getElementById('comic-dropzone');
    const fileInput = document.getElementById('batch-file-input');
    const selectedInfo = document.getElementById('selected-file-info');
    const fileNameDisplay = document.getElementById('selected-file-name');
    const clearFileBtn = document.getElementById('btn-clear-file');
    const runBatchBtn = document.getElementById('btn-run-batch');
    const preloadedBtn = document.getElementById('btn-preloaded-batch');

    let currentFile = null;

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Comic Lab Warning: Only CSV (.csv) files are supported.');
            return;
        }
        currentFile = file;
        fileNameDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        selectedInfo.style.display = 'inline-flex';
        runBatchBtn.disabled = false;
    }

    clearFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentFile = null;
        fileInput.value = '';
        selectedInfo.style.display = 'none';
        runBatchBtn.disabled = true;
    });

    // Execute uploaded CSV
    runBatchBtn.addEventListener('click', () => {
        if (!currentFile) return;
        const formData = new FormData();
        formData.append('file', currentFile);
        executeBatch(formData);
    });

    // Execute preloaded test set
    preloadedBtn.addEventListener('click', () => {
        const formData = new FormData();
        formData.append('use_preloaded', 'true');
        executeBatch(formData);
    });
}

async function executeBatch(formData) {
    const loadingState = document.getElementById('batch-loading-state');
    const resultsContainer = document.getElementById('batch-results-container');
    const runBatchBtn = document.getElementById('btn-run-batch');
    const preloadedBtn = document.getElementById('btn-preloaded-batch');

    loadingState.style.display = 'block';
    resultsContainer.style.display = 'none';
    runBatchBtn.disabled = true;
    preloadedBtn.disabled = true;

    try {
        const res = await fetch('/api/batch-predict', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            renderBatchResults(data);
        } else {
            alert(`Batch Inference Error: ${data.error}`);
        }
    } catch (err) {
        alert(`Network error during batch inference: ${err.message}`);
    } finally {
        loadingState.style.display = 'none';
        runBatchBtn.disabled = false;
        preloadedBtn.disabled = false;
    }
}

function renderBatchResults(data) {
    const resultsContainer = document.getElementById('batch-results-container');
    const rowsKpi = document.getElementById('batch-kpi-rows');
    const meanKpi = document.getElementById('batch-kpi-mean');
    const rangeKpi = document.getElementById('batch-kpi-range');
    const evalCard = document.getElementById('batch-kpi-eval-card');
    const evalScore = document.getElementById('batch-kpi-eval-score');
    const evalLabel = document.getElementById('batch-kpi-eval-label');
    const downloadBtn = document.getElementById('btn-download-batch-csv');
    const tableBody = document.getElementById('batch-table-body');
    const previewCount = document.getElementById('batch-preview-count');

    const s = data.summary;
    rowsKpi.textContent = s.total_rows.toLocaleString();
    meanKpi.textContent = s.formatted_mean_price;
    rangeKpi.textContent = `${s.formatted_min_price} - ${s.formatted_max_price}`;

    if (s.has_actuals) {
        evalCard.style.display = 'flex';
        evalScore.textContent = `MAE ${s.formatted_mae}`;
        evalLabel.innerHTML = `R&sup2;: ${s.r2} &bull; RMSE: ${s.formatted_rmse}`;
    } else {
        evalCard.style.display = 'none';
    }

    // Set download URL
    downloadBtn.href = `/api/download-batch/${data.batch_id}`;

    // Populate preview table
    previewCount.textContent = `SHOWING FIRST ${data.preview.length} OF ${s.total_rows} RECORDS`;
    tableBody.innerHTML = '';

    data.preview.forEach((row, idx) => {
        const tr = document.createElement('tr');
        
        const lat = row.latitude !== undefined ? Number(row.latitude).toFixed(2) : '-';
        const lon = row.longitude !== undefined ? Number(row.longitude).toFixed(2) : '-';
        const age = row.housing_median_age !== undefined ? Math.round(row.housing_median_age) : '-';
        const inc = row.median_income !== undefined ? `$${(row.median_income * 10000).toLocaleString()}` : '-';
        const prox = row.ocean_proximity || '-';
        const pred = row.predicted_house_value !== undefined ? `$${Number(row.predicted_house_value).toLocaleString()}` : '-';
        const act = row.median_house_value !== undefined ? `$${Number(row.median_house_value).toLocaleString()}` : 'N/A';
        const err = row.abs_error !== undefined ? `$${Number(row.abs_error).toLocaleString()}` : 'N/A';

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${lat}&deg;</td>
            <td>${lon}&deg;</td>
            <td>${age} yrs</td>
            <td>${inc}</td>
            <td><strong>${prox}</strong></td>
            <td><strong>${pred}</strong></td>
            <td>${act}</td>
            <td>${err}</td>
        `;
        tableBody.appendChild(tr);
    });

    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

/* ==========================================================================
   04. DASHBOARD & TRAINING INTEL MODULE
   ========================================================================== */
window.dashboardLoaded = false;
let chartScatterInstance = null;
let chartHistInstance = null;
let chartOceanInstance = null;

let currentSelectedProximity = 'ALL';
let currentPriceCap = 500001;

function initDashboard() {
    const chipButtons = document.querySelectorAll('#chip-group-ocean .comic-chip');
    const priceSlider = document.getElementById('dash-price-slider');
    const priceLabel = document.getElementById('dash-price-val');

    // Region chip filters
    chipButtons.forEach(chip => {
        chip.addEventListener('click', () => {
            chipButtons.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentSelectedProximity = chip.getAttribute('data-val');
            loadDashboardData();
        });
    });

    // Price slider filter with debounce
    let debounceTimer;
    priceSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        currentPriceCap = val;
        if (val >= 500000) {
            priceLabel.textContent = 'ALL ($500K+)';
        } else {
            priceLabel.textContent = `< $${Math.round(val).toLocaleString()}`;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadDashboardData();
        }, 300);
    });
}

async function loadDashboardData() {
    window.dashboardLoaded = true;
    
    let url = `/api/dashboard-data?ocean_proximity=${encodeURIComponent(currentSelectedProximity)}`;
    if (currentPriceCap < 500000) {
        url += `&max_price=${currentPriceCap}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            alert(`Dashboard error: ${data.error}`);
            return;
        }

        renderDashboardKPIs(data);
        renderScatterChart(data.scatter);
        renderErrorHistChart(data.error_hist);
        renderOceanBarChart(data.ocean_breakdown);
        renderWorstPredictionsTable(data.worst_predictions);

    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    }
}

function renderDashboardKPIs(data) {
    const maeEl = document.getElementById('dash-mae');
    const rmseEl = document.getElementById('dash-rmse');
    const r2El = document.getElementById('dash-r2');
    const countEl = document.getElementById('dash-count');

    if (data.metrics) {
        maeEl.textContent = data.metrics.formatted_mae;
        rmseEl.textContent = data.metrics.formatted_rmse;
        r2El.textContent = data.metrics.r2;
    }
    countEl.textContent = data.total_rows.toLocaleString();
}

/* --- MONOCHROME CHARTS CONFIGURATION --- */

// Chart 1: Actual vs Predicted Scatter
function renderScatterChart(scatterPoints) {
    const ctx = document.getElementById('chart-scatter').getContext('2d');
    if (chartScatterInstance) {
        chartScatterInstance.destroy();
    }

    // Reference 45 degree perfect line (0 to 500k)
    const lineRef = [
        { x: 0, y: 0 },
        { x: 500000, y: 500000 }
    ];

    chartScatterInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Perfect Fit (y = x)',
                    data: lineRef,
                    type: 'line',
                    borderColor: '#000000',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Predictions',
                    data: scatterPoints,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    borderColor: '#000000',
                    borderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#000000',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#000000',
                    borderWidth: 2,
                    titleFont: { family: "'JetBrains Mono', monospace" },
                    bodyFont: { family: "'JetBrains Mono', monospace" },
                    callbacks: {
                        label: (ctx) => `Actual: $${ctx.parsed.x.toLocaleString()} | Predicted: $${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Actual Median Value ($)',
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700' }
                    },
                    grid: { color: '#e5e5e5' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                        callback: (v) => `$${v / 1000}k`
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Predicted Value ($)',
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700' }
                    },
                    grid: { color: '#e5e5e5' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                        callback: (v) => `$${v / 1000}k`
                    }
                }
            }
        }
    });
}

// Chart 2: Residual / Error Distribution Histogram
function renderErrorHistChart(histData) {
    const ctx = document.getElementById('chart-error-hist').getContext('2d');
    if (chartHistInstance) {
        chartHistInstance.destroy();
    }

    chartHistInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: histData.labels,
            datasets: [{
                label: 'Residual Frequency (Pred - Actual)',
                data: histData.counts,
                backgroundColor: '#000000',
                borderColor: '#000000',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#000000',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: (ctx) => `Count: ${ctx.parsed.y} houses`
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Residual Error ($)',
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700' }
                    },
                    grid: { color: '#f0f0f0' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'JetBrains Mono', monospace", size: 9 },
                        maxRotation: 45
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Properties',
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700' }
                    },
                    grid: { color: '#e5e5e5' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'JetBrains Mono', monospace", size: 10 }
                    }
                }
            }
        }
    });
}

// Chart 3: Ocean Proximity Comparison Bar Chart
function renderOceanBarChart(oceanData) {
    const ctx = document.getElementById('chart-ocean-bar').getContext('2d');
    if (chartOceanInstance) {
        chartOceanInstance.destroy();
    }

    const labels = oceanData.map(d => d.proximity);
    const actuals = oceanData.map(d => d.avg_actual);
    const predicteds = oceanData.map(d => d.avg_predicted);

    chartOceanInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Mean Actual Value',
                    data: actuals,
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    borderWidth: 2
                },
                {
                    label: 'Mean Predicted Value',
                    data: predicteds,
                    backgroundColor: '#9e9e9e',
                    borderColor: '#000000',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700', size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#000000',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f0f0f0' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'Bangers', cursive, sans-serif", size: 14, letterSpacing: 1 }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Average Valuation ($)',
                        color: '#000000',
                        font: { family: "'Space Grotesk', sans-serif", weight: '700' }
                    },
                    grid: { color: '#e5e5e5' },
                    ticks: {
                        color: '#000000',
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                        callback: (v) => `$${v / 1000}k`
                    }
                }
            }
        }
    });
}

// Top Worst Predictions Table
function renderWorstPredictionsTable(worstList) {
    const tbody = document.getElementById('worst-table-body');
    tbody.innerHTML = '';

    worstList.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.latitude.toFixed(2)}&deg;</td>
            <td>${r.longitude.toFixed(2)}&deg;</td>
            <td>$${(r.median_income * 10000).toLocaleString()}</td>
            <td><strong>${r.ocean_proximity}</strong></td>
            <td>$${r.actual.toLocaleString()}</td>
            <td>$${r.predicted.toLocaleString()}</td>
            <td><strong>$${r.abs_error.toLocaleString()}</strong></td>
            <td>${r.pct_error}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function resizeAllCharts() {
    if (chartScatterInstance) chartScatterInstance.resize();
    if (chartHistInstance) chartHistInstance.resize();
    if (chartOceanInstance) chartOceanInstance.resize();
}
