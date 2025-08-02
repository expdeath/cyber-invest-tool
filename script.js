// --- 📍 YOUR API KEY IS NOW PASSED IN THE URL ---
const MODEL_NAME = "gemini-2.5-flash";

// --- GLOBAL STATE ---
let charts = {};
let assetInventory = [
    { id: 1, name: 'Primary Web Server', type: 'Server', importance: 5 },
    { id: 2, name: 'Customer Database', type: 'Database', importance: 5 },
    { id: 3, name: 'Executive Laptop', type: 'Endpoint', importance: 4 }
];
let chartData = { 
    allocation: { labels: [], data: [] },
    trend: [] 
};
let currentAbortController = null;
let currentAnalysisDetails = {};
let analysisHasBeenRun = false;

// ... (metricExplanations and sampleAnalysisData are unchanged) ...
const metricExplanations = { assets: { title: "High-Importance Assets Addressed", text: "This shows how many high-importance assets (Importance > 3) your plan directly addresses out of the total in your inventory. The AI determines which initiatives have the most impact on securing these key assets." }, risk: { title: "New Risk Score", text: "This is the AI's projection of your organization's overall cybersecurity risk score (from 0-100) *after* the recommended investments are implemented. It reflects the risk reduction achieved by the new initiatives." }, threats: { title: "Projected Incident Reduction", text: "This is the AI's estimate of the percentage reduction in security incidents (like data breaches or downtime) you can expect over the next year as a result of implementing the proposed investment plan." }, rosi: { title: "Return on Security Investment (ROSI)", text: "ROSI is a percentage calculated by the AI to estimate the financial value of your security plan. It compares the cost of the investment against the potential financial losses from security incidents that are now avoided." }, compliance: { title: "Compliance Uplift", text: "This metric represents the AI's estimate of how much your recommended security plan will improve your organization's posture against common regulatory standards (like GDPR or HIPAA), particularly in relation to your stated security goals." }, budget: { title: "New Budget", text: "This shows the total annual budget you provided for the analysis. The 'Investment Allocation' chart on the dashboard breaks down how the AI recommends distributing this budget across different security initiatives." }, trend: { title: "Risk Reduction Trend", text: "This chart shows the AI's projection of your organization's overall risk score over the next six months as you implement the recommended security plan. It illustrates the expected positive impact of your investment over time." }, exposure: { title: "Threat Exposure Reduction", text: "The AI's estimate of the percentage reduction in your organization's attack surface and overall exposure to external threats based on the recommended investments." }, attr: { title: "ATTR Improvement", text: "The estimated percentage improvement (reduction) in the Average Time to Remediate (ATTR) vulnerabilities after implementing the new tools and procedures." }, maturity: { title: "Security Maturity Level", text: "The AI's assessment of your organization's projected cybersecurity maturity level (e.g., 'Level 1 - Initial' to 'Level 5 - Optimizing') after the investments are made." }, focus: { title: "Primary Focus Area", text: "The AI has identified this as the single most critical area for investment from the recommended plan, likely to yield the highest risk reduction." } };
const sampleAnalysisData = { dashboard_metrics: { high_risk_assets_addressed: { addressed: 2, total: 3 }, new_risk_score: 52, projected_incidents_reduced: 25, return_on_security_investment: 150, compliance_uplift: 30, addressed_asset_names: ["Primary Web Server", "Customer Database"], risk_reduction_trend: [90, 82, 75, 68, 60, 52], threat_exposure_reduction: 18, attr_improvement: 22, security_maturity_level: "Level 2 (Managed)", primary_focus_area: "Endpoint Security" }, initiatives: [ { initiative: 'Advanced Endpoint Security', percentage: 40, description: "Deploys next-gen antivirus and EDR solutions to protect laptops and endpoints from malware and ransomware.", rationale: "Chosen because the inventory contains high-importance endpoints, which are primary targets for ransomware attacks.", nist_functions: ["Protect", "Detect", "Respond"] }, { initiative: 'Cloud Security Posture Management', percentage: 35, description: "Scans and hardens cloud configurations (like in AWS or Azure) to prevent common misconfigurations that lead to breaches.", rationale: "Addresses the high importance of the 'Primary Web Server' and 'Customer Database' which are likely cloud-hosted.", nist_functions: ["Identify", "Protect"] }, { initiative: 'Employee Security Training', percentage: 25, description: "Conducts regular, engaging training and phishing simulations to reduce the risk of human error.", rationale: "Reduces overall risk by strengthening the human element of security, which affects all assets.", nist_functions: ["Protect"] } ] };

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run-detailed-analysis-btn').addEventListener('click', runInventoryAnalysis);
    document.getElementById('run-risk-analysis-btn').addEventListener('click', runRiskAnalysis);
    document.getElementById('add-asset-btn').addEventListener('click', addAsset);
    const inventoryToggle = document.getElementById('use-inventory-toggle');
    const inventoryCard = document.getElementById('asset-inventory-card');
    inventoryToggle.checked = false;
    inventoryCard.style.display = 'none';
    inventoryToggle.addEventListener('change', (e) => {
        inventoryCard.style.display = e.target.checked ? 'block' : 'none';
    });
    document.getElementById('cancel-analysis-btn').addEventListener('click', () => {
        if (currentAbortController) currentAbortController.abort();
    });
    setupModals();
    currentAnalysisDetails = {
        addressedAssets: sampleAnalysisData.dashboard_metrics.addressed_asset_names,
        initiatives: sampleAnalysisData.initiatives
    };
    updateDashboard(sampleAnalysisData.initiatives, sampleAnalysisData.dashboard_metrics, 750000);
    renderTable();
    showSection('dashboard', document.querySelector('.nav-btn'));
});

// --- MODAL LOGIC ---
function setupModals() {
    // ... (This function is unchanged)
    const explanationModal = document.getElementById('explanation-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalDetailsContent = document.getElementById('modal-details-content');
    const showExplanationModal = (metricKey) => {
        const explanation = metricExplanations[metricKey];
        if (!explanation) return;
        document.getElementById('modal-title').textContent = explanation.title;
        document.getElementById('modal-text').textContent = explanation.text;
        modalDetailsContent.innerHTML = '';
        modalDetailsContent.style.display = 'none';
        const oldBtn = explanationModal.querySelector('.btn-view-assets');
        if (oldBtn) oldBtn.remove();
        if (metricKey === 'assets' && currentAnalysisDetails.addressedAssets?.length > 0) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-view-assets';
            viewBtn.textContent = 'View Addressed Assets';
            viewBtn.onclick = () => {
                const assetsHtml = `<ul>${currentAnalysisDetails.addressedAssets.map(name => `<li>${name}</li>`).join('')}</ul>`;
                modalDetailsContent.innerHTML = assetsHtml;
                modalDetailsContent.style.display = 'block';
                viewBtn.style.display = 'none';
            };
            modalDetailsContent.insertAdjacentElement('beforebegin', viewBtn);
        }
        explanationModal.style.display = 'flex';
    };
    const hideExplanationModal = () => {
        explanationModal.style.display = 'none';
        const oldBtn = explanationModal.querySelector('.btn-view-assets');
        if (oldBtn) oldBtn.remove();
    };
    const detailsModal = document.getElementById('details-modal');
    const detailsModalCloseBtn = document.getElementById('details-modal-close-btn');
    const showInitiativesModal = () => {
        if (!currentAnalysisDetails.initiatives || currentAnalysisDetails.initiatives.length === 0) return;
        document.getElementById('details-modal-title').textContent = "Investment Initiative Details";
        const textContainer = document.getElementById('details-modal-text');
        const initiativesHtml = currentAnalysisDetails.initiatives.map(item => {
            const nistTagsHtml = (item.nist_functions || []).map(func => `<span class="nist-tag">${func}</span>`).join('');
            return `<li><h4>${item.initiative} <span>(${item.percentage}%)</span></h4><p>${item.description}</p><p class="initiative-rationale"><b>Rationale:</b> ${item.rationale}</p><div class="nist-tags-container">${nistTagsHtml}</div></li>`;
        }).join('');
        textContainer.innerHTML = `<ul class="initiatives-list">${initiativesHtml}</ul>`;
        detailsModal.style.display = 'flex';
    };
    const hideDetailsModal = () => { detailsModal.style.display = 'none'; };
    document.getElementById('card-assets').addEventListener('click', () => showExplanationModal('assets'));
    document.getElementById('card-risk').addEventListener('click', () => showExplanationModal('risk'));
    document.getElementById('card-threats').addEventListener('click', () => showExplanationModal('threats'));
    document.getElementById('card-rosi').addEventListener('click', () => showExplanationModal('rosi'));
    document.getElementById('card-compliance').addEventListener('click', () => showExplanationModal('compliance'));
    document.getElementById('card-budget').addEventListener('click', () => showExplanationModal('budget'));
    document.getElementById('card-pie-chart').addEventListener('click', showInitiativesModal);
    document.getElementById('card-line-chart').addEventListener('click', () => showExplanationModal('trend'));
    document.getElementById('card-exposure').addEventListener('click', () => showExplanationModal('exposure'));
    document.getElementById('card-attr').addEventListener('click', () => showExplanationModal('attr'));
    document.getElementById('card-maturity').addEventListener('click', () => showExplanationModal('maturity'));
    document.getElementById('card-focus').addEventListener('click', () => showExplanationModal('focus'));
    modalCloseBtn.addEventListener('click', hideExplanationModal);
    explanationModal.addEventListener('click', (e) => { if (e.target === explanationModal) hideExplanationModal(); });
    detailsModalCloseBtn.addEventListener('click', hideDetailsModal);
    detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) hideDetailsModal(); });
}

// --- NAVIGATION & CHART INIT ---
function showSection(sectionId, buttonElement) {
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (buttonElement) buttonElement.classList.add('active');
    if (sectionId === 'dashboard') { initializeCharts(); }
}

function initializeCharts() {
    initRiskReductionTrendChart(chartData.trend);
    initAiAllocationChart(chartData.allocation.labels, chartData.allocation.data);
}

// --- UTILITY FUNCTION ---
function cleanAndParseJson(rawResponse) {
    const cleaned = rawResponse.replace(/```json\s*|\s*```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Failed to parse JSON:", cleaned);
        throw new Error("AI returned a non-JSON response.");
    }
}

function getApiKey() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('apiKey');
}

// --- ANALYSIS LOGIC ---
function runInventoryAnalysis() {
    const useInventory = document.getElementById('use-inventory-toggle').checked;
    if (useInventory && assetInventory.length === 0) {
        alert("Please add assets to the inventory first, or uncheck the 'Use Custom Asset Inventory' box.");
        return;
    }
    const budget = document.getElementById('detailed-budget').value;
    const industry = document.getElementById('detailed-industry').value;
    const companySize = document.getElementById('detailed-companySize').value;
    const primaryGoal = document.getElementById('detailed-primaryGoal').value;
    let inventoryString = "No custom asset inventory provided.";
    if (useInventory) {
        inventoryString = "| Name | Type | Importance (0-5) |\n|---|---|---|\n";
        assetInventory.forEach(a => { inventoryString += `| ${a.name} | ${a.type} | ${a.importance} |\n`; });
    }
    let prompt = `Act as a cybersecurity investment analyst. Based on company details (${industry}, ${companySize}, £${budget} budget, goal: "${primaryGoal}") and this asset inventory:\n${inventoryString}\n\nYour response MUST be a single valid JSON object that strictly follows this structure: {"dashboard_metrics": {"high_risk_assets_addressed": {"addressed": /* (Number) */, "total": /* (Number) */, "addressed_asset_names": [/* (Array of Strings) */]}, "new_risk_score": /* (Number) */, "projected_incidents_reduced": /* (Number) */, "return_on_security_investment": /* (Number) */, "compliance_uplift": /* (Number) */, "risk_reduction_trend": [/* (Array of 6 Numbers) */], "threat_exposure_reduction": /* (Number) */, "attr_improvement": /* (Number) */, "security_maturity_level": "/* (String) */", "primary_focus_area": "/* (String) */"}, "initiatives": [{"initiative": "/* (String) */", "percentage": /* (Number) */, "description": "/* (String) */", "rationale": "/* (String) */", "nist_functions": [/* (Array of Strings) e.g., "Protect", "Detect" */]}]}`;
    prompt = getAnalysisPrompt(industry,companySize,budget,primaryGoal,inventoryString);
    callInvestmentAPI(prompt, budget);
}

function getAnalysisPrompt(industry,companySize,budget,goal,assets) {
    return `Act as an Cybersecurity Investment Analyst taking below as Inputs
Company Segment: ${industry}
Company Size: ${companySize}
Security Budget: ${budget}(In Pounds)
End goal: ${goal}
Asset inventory as below:
${assets}

Analyze the risk for above inputs and utilize below as data for generating response 

### Project Overview and Motivation
The project operates within the field of **cybersecurity economics**, which studies how organizations should invest in their digital defense. The central problem is twofold: organizations often don't invest *enough* in cybersecurity, and the money they do spend is frequently not allocated to the most effective security measures. This challenge is magnified by constantly growing organizational complexity and an ever-expanding number of potential attack vectors, making manual decision-making impractical and unreliable.
While sophisticated mathematical optimization models exist to solve this problem, they are typically inaccessible to decision-makers who lack specialized expertise in optimization theory and programming. This creates a critical gap between academic solutions and real-world business needs.

### Core Objective: A User-Friendly Decision-Support Tool
The primary goal of this project is to bridge that gap by developing a **user-friendly decision-support tool**, preferably as an interactive **web application**. The tool is designed specifically for managers and security professionals who may not be optimization experts, enabling them to leverage advanced analytical methods for their security planning.
The application will have two main functions:
1.  **Evaluation of Current Security Posture:** Users will be able to input their existing portfolio of security controls (e.g., firewalls, antivirus software, employee training programs). The tool will then analyze this portfolio to evaluate its overall effectiveness against a modeled threat landscape.
2.  **Actionable Recommendations for Optimization:** After the evaluation, the tool will provide concrete, actionable recommendations for improvement. These recommendations will not just be a single "best" solution but will represent an **optimized and resilient portfolio** that strategically allocates the security budget. A key feature is the model's ability to **account for uncertainties**, such as the likelihood of a specific attack or the evolving capabilities of adversaries.

### Theoretical Foundations (Based on References)
The tool's "intelligence" will be based on state-of-the-art academic research to ensure the recommendations are robust and scientifically sound. The provided references suggest the project will likely incorporate advanced models such as:
* **Scalable Min-Max Optimisation:** This method finds the best possible security strategy even when assuming a worst-case attack scenario, ensuring resilience.
* **Probabilistic Attack Graphs:** These models map out potential paths an attacker could take through a network, assigning probabilities to each step to quantify risk more accurately.
* **Bayesian Stackelberg Games:** This game-theoretic approach models the strategic interaction between a defender and an attacker. It is particularly useful for making decisions under uncertainty, where the defender has incomplete information about the attacker.
By integrating these advanced concepts into an accessible web tool, the project aims to empower organizations to make smarter, data-driven, and cost-effective cybersecurity investment decisions.

Your response MUST be a single valid JSON object that strictly follows this structure: {"dashboard_metrics": {"high_risk_assets_addressed": {"addressed": /* (Number) */, "total": /* (Number) */, "addressed_asset_names": [/* (Array of Strings) */]}, "new_risk_score": /* (Number) */, "projected_incidents_reduced": /* (Number) */, "return_on_security_investment": /* (Number) */, "compliance_uplift": /* (Number) */, "risk_reduction_trend": [/* (Array of 6 Numbers) */], "threat_exposure_reduction": /* (Number) */, "attr_improvement": /* (Number) */, "security_maturity_level": "/* (String) */", "primary_focus_area": "/* (String) */"}, "initiatives": [{"initiative": "/* (String) */", "percentage": /* (Number) */, "description": "/* (String) */", "rationale": "/* (String) */", "nist_functions": [/* (Array of Strings) e.g., "Protect", "Detect" */]}]}
`;
}

function getPredictiveAnalysisPrompt(industry,companySize,budget,goal,assets) {
    return `Act as a predictive risk analyst taking below as Inputs
Company Segment: ${industry}
Company Size: ${companySize}
Security Budget: ${budget}(In Pounds)
End goal: ${goal}
Asset inventory as below:
${assets}

Analyze the risk for above inputs and utilize below as data for generating response 

### Project Overview and Motivation
The project operates within the field of **cybersecurity economics**, which studies how organizations should invest in their digital defense. The central problem is twofold: organizations often don't invest *enough* in cybersecurity, and the money they do spend is frequently not allocated to the most effective security measures. This challenge is magnified by constantly growing organizational complexity and an ever-expanding number of potential attack vectors, making manual decision-making impractical and unreliable.
While sophisticated mathematical optimization models exist to solve this problem, they are typically inaccessible to decision-makers who lack specialized expertise in optimization theory and programming. This creates a critical gap between academic solutions and real-world business needs.

### Core Objective: A User-Friendly Decision-Support Tool
The primary goal of this project is to bridge that gap by developing a **user-friendly decision-support tool**, preferably as an interactive **web application**. The tool is designed specifically for managers and security professionals who may not be optimization experts, enabling them to leverage advanced analytical methods for their security planning.
The application will have two main functions:
1.  **Evaluation of Current Security Posture:** Users will be able to input their existing portfolio of security controls (e.g., firewalls, antivirus software, employee training programs). The tool will then analyze this portfolio to evaluate its overall effectiveness against a modeled threat landscape.
2.  **Actionable Recommendations for Optimization:** After the evaluation, the tool will provide concrete, actionable recommendations for improvement. These recommendations will not just be a single "best" solution but will represent an **optimized and resilient portfolio** that strategically allocates the security budget. A key feature is the model's ability to **account for uncertainties**, such as the likelihood of a specific attack or the evolving capabilities of adversaries.

### Theoretical Foundations (Based on References)
The tool's "intelligence" will be based on state-of-the-art academic research to ensure the recommendations are robust and scientifically sound. The provided references suggest the project will likely incorporate advanced models such as:
* **Scalable Min-Max Optimisation:** This method finds the best possible security strategy even when assuming a worst-case attack scenario, ensuring resilience.
* **Probabilistic Attack Graphs:** These models map out potential paths an attacker could take through a network, assigning probabilities to each step to quantify risk more accurately.
* **Bayesian Stackelberg Games:** This game-theoretic approach models the strategic interaction between a defender and an attacker. It is particularly useful for making decisions under uncertainty, where the defender has incomplete information about the attacker.
By integrating these advanced concepts into an accessible web tool, the project aims to empower organizations to make smarter, data-driven, and cost-effective cybersecurity investment decisions.

Your response MUST be a single valid JSON object with a single key "risk_assessment". Its value must be an array of objects, each with these keys: "domain" (one of 5 specific values), "risk_score" (0-100), "mitigation_percent" (0-100), "future_issues" (string), and "mitigation_steps" (array of strings).
`;
}

async function runRiskAnalysis() {
    const useInventory = document.getElementById('use-inventory-toggle').checked;
    if (useInventory && assetInventory.length === 0) {
        alert("Please add assets to the inventory first, or uncheck the 'Use Custom Asset Inventory' box to run an analysis without it.");
        document.getElementById('asset-inventory-card').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    const budget = document.getElementById('detailed-budget').value;
    const industry = document.getElementById('detailed-industry').value;
    const companySize = document.getElementById('detailed-companySize').value;
    const primaryGoal = document.getElementById('detailed-primaryGoal').value;

    let inventoryString = "No custom asset inventory provided.";
    if (useInventory) {
        inventoryString = "| Name | Type | Importance (0-5) |\n|---|---|---|\n";
        assetInventory.forEach(a => { inventoryString += `| ${a.name} | ${a.type} | ${a.importance} |\n`; });
    }

    let prompt = getPredictiveAnalysisPrompt(industry, companySize, budget, primaryGoal, inventoryString);
    const resultsContainer = document.getElementById('ai-results-container');
    currentAbortController = new AbortController();
    try {
        resultsContainer.style.display = 'flex';
        const aiResponse = await callGeminiAPIWithRetry(prompt, true, currentAbortController.signal);
        const result = cleanAndParseJson(aiResponse);
        const assessments = result.risk_assessment || result;
        
        console.log("Received AI assessment data:", assessments);

        if (assessments && Array.isArray(assessments) && assessments.length > 0) {
            updateRiskDashboard(assessments);
            showSection('dashboard', document.querySelector('button[onclick*="dashboard"]'));
            document.getElementById('risk-assessment-section').scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error("AI did not return valid 'risk_assessment' data.");
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert(`An error occurred: ${error.message}`);
        }
    } finally {
        resultsContainer.style.display = 'none';
        currentAbortController = null;
    }
}

// --- CORE API & DASHBOARD FUNCTIONS ---
async function callInvestmentAPI(prompt, budget) {
    const resultsContainer = document.getElementById('ai-results-container');
    currentAbortController = new AbortController();
    try {
        resultsContainer.style.display = 'flex';
        const aiResponse = await callGeminiAPIWithRetry(prompt, true, currentAbortController.signal);
        const result = cleanAndParseJson(aiResponse);
        if (result.initiatives && result.dashboard_metrics) {
            analysisHasBeenRun = true;
            document.getElementById('run-risk-analysis-btn').disabled = false;
            document.getElementById('risk-assessment-section').style.display = 'block';
            currentAnalysisDetails = {
                addressedAssets: result.dashboard_metrics.addressed_asset_names || [],
                initiatives: result.initiatives || []
            };
            updateDashboard(result.initiatives, result.dashboard_metrics, budget);
            showSection('dashboard', document.querySelector('button[onclick*="dashboard"]'));
        } else {
            throw new Error("AI returned incomplete analysis data.");
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert(`An error occurred: ${error.message}`);
        }
    } finally {
        resultsContainer.style.display = 'none';
        currentAbortController = null;
    }
}

async function callGeminiAPIWithRetry(prompt, jsonMode = false, signal, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await callGeminiAPI(prompt, jsonMode, signal);
        } catch (error) {
            if (signal.aborted) {
                console.log('Request aborted by user.');
                throw error;
            }
            console.error(`Attempt ${attempt + 1} failed:`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 4000));
            } else {
                throw new Error(`Failed after ${maxRetries + 1} attempts.`);
            }
        }
    }
}

async function callGeminiAPI(prompt, jsonMode = false, signal) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API Key not provided in URL. Please add '?apiKey=YOUR_KEY' to the URL.");
    }
    const generationConfig = {
        temperature: 0,
        ...(jsonMode && { response_mime_type: "application/json" })
    };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
        signal: signal
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error.message}`);
    }
    const data = await response.json();
    if (!data.candidates) {
        console.log("API Response Blocked:", data);
        throw new Error("AI response was blocked or invalid.");
    }
    return data.candidates[0].content.parts[0].text;
}

function updateDashboard(allocations, metrics, budget) {
    let addressed = metrics?.high_risk_assets_addressed?.addressed;
    let total = metrics?.high_risk_assets_addressed?.total;
    if (addressed === undefined || total === undefined) {
        console.warn("AI did not provide 'high_risk_assets_addressed' counts. Calculating from asset data.");
        const useInventory = document.getElementById('use-inventory-toggle').checked;
        if (useInventory && assetInventory.length > 0) {
            total = assetInventory.filter(a => a.importance > 3).length;
            addressed = metrics?.addressed_asset_names?.length ?? 0;
        } else {
            total = 'N/A';
            addressed = 'N/A';
        }
    }
    document.getElementById('metric-assets').textContent = `${addressed} of ${total}`;
    document.getElementById('metric-risk').textContent = metrics?.new_risk_score ?? 'N/A';
    document.getElementById('metric-threats').textContent = `${metrics?.projected_incidents_reduced ?? 'N/A'}%`;
    document.getElementById('metric-rosi').textContent = `${metrics?.return_on_security_investment ?? 'N/A'}%`;
    document.getElementById('metric-compliance').textContent = `${metrics?.compliance_uplift ?? 'N/A'}%`;
    document.getElementById('metric-budget').textContent = `£${Math.round(budget / 1000)}k`;
    document.getElementById('metric-exposure').textContent = `${metrics?.threat_exposure_reduction ?? 'N/A'}%`;
    document.getElementById('metric-attr').textContent = `${metrics?.attr_improvement ?? 'N/A'}%`;
    const maturityEl = document.getElementById('metric-maturity');
    maturityEl.textContent = metrics?.security_maturity_level ?? 'N/A';
    maturityEl.classList.toggle('text-metric', isNaN(metrics?.security_maturity_level));
    const focusEl = document.getElementById('metric-focus');
    focusEl.textContent = metrics?.primary_focus_area ?? 'N/A';
    focusEl.classList.toggle('text-metric', isNaN(metrics?.primary_focus_area));
    chartData.allocation = { labels: allocations.map(a => a.initiative), data: allocations.map(a => a.percentage) };
    chartData.trend = metrics?.risk_reduction_trend ?? [90, 82, 75, 68, 60, 52];
    initializeCharts();
}

function updateRiskDashboard(assessments) {
    const section = document.getElementById('risk-assessment-section');
    const container = document.getElementById('risk-analysis-results');
    container.innerHTML = '';
    const findDomainKey = (aiDomain) => {
        if (!aiDomain) return null;
        const lowerAiDomain = aiDomain.toLowerCase();
        const domainKeywords = { "Critical Infrastructure": ["infra"], "Data Assets": ["data"], "Human Resources": ["human", "employee"], "Network Perimeter": ["network", "perimeter"], "Third-party Services": ["third-party", "third party", "supply chain"] };
        for (const key in domainKeywords) {
            for (const keyword of domainKeywords[key]) {
                if (lowerAiDomain.includes(keyword)) return key;
            }
        }
        return null;
    };
    const cardsHtml = assessments.map(item => {
        let colorClass = 'low';
        if (item.risk_score > 75) colorClass = 'high';
        else if (item.risk_score > 50) colorClass = 'medium';
        const mitigationStepsHtml = item.mitigation_steps.map(step => `<li>${step}</li>`).join('');
        return `<div class="card risk-card"><h3>${item.domain}</h3><div class="risk-summary"><p class="risk-score ${colorClass}">${item.risk_score}</p><div class="mitigation-details"><div class="mitigation-bar"><div class="mitigation-fill" style="width: ${item.mitigation_percent}%;"></div></div><p class="mitigation-text">${item.mitigation_percent}% Mitigated</p></div></div><div class="risk-details"><h4>Potential Future Issues</h4><p class="future-issues-text">${item.future_issues}</p><h4>Recommended Mitigations</h4><ul class="mitigation-list">${mitigationStepsHtml}</ul></div></div>`;
    }).join('');
    if (cardsHtml.trim() === '') {
        section.style.display = 'block';
        container.innerHTML = `<p style="text-align: center; color: #94a3b8; grid-column: 1 / -1;">The AI returned an analysis, but the content could not be displayed. This may be a temporary issue. Please try again.</p>`;
    } else {
        section.style.display = 'block';
        container.innerHTML = cardsHtml;
    }
}

// --- CHART DRAWING ---
function initAiAllocationChart(labels, data) {
    const ctx = document.getElementById('aiAllocationChart'); if (!ctx) return; if (charts.aiAllocation) charts.aiAllocation.destroy(); if (!data || data.length === 0) return;
    charts.aiAllocation = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#4f46e5', '#22c55e', '#facc15', '#f97316', '#a855f7'], borderColor: '#1e293b', borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', titleFont: { size: 16, weight: 'bold' }, bodyColor: '#cbd5e1', bodyFont: { size: 14 }, borderColor: '#334155', borderWidth: 1, padding: 12, callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += `${context.parsed}%`; } return label; } } } } } });
}

function initRiskReductionTrendChart(data) {
    const ctx = document.getElementById('riskReductionChart'); if (!ctx) return; if (charts.riskReduction) charts.riskReduction.destroy();
    charts.riskReduction = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'], 
            datasets: [{ 
                label: 'Risk Score', 
                data: data, 
                borderColor: '#4f46e5', 
                backgroundColor: 'rgba(79, 70, 229, 0.1)', 
                tension: 0.4, 
                fill: true 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: { 
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }, 
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } } 
            }, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyColor: '#cbd5e1',
                    bodyFont: { size: 12 },
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => tooltipItems[0].label,
                        label: (context) => `Projected Risk Score: ${context.raw}`
                    }
                }
            } 
        } 
    });
}

// --- ASSET INVENTORY TABLE LOGIC ---
function renderTable() {
    const tableBody = document.getElementById('asset-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    assetInventory.forEach(asset => {
        const row = document.createElement('tr');
        row.dataset.id = asset.id;
        row.innerHTML = `<td><input type="text" value="${asset.name}" data-key="name"></td><td><select data-key="type"><option ${asset.type === 'Server' ? 'selected' : ''}>Server</option><option ${asset.type === 'Database' ? 'selected' : ''}>Database</option><option ${asset.type === 'Network' ? 'selected' : ''}>Network</option><option ${asset.type === 'Endpoint' ? 'selected' : ''}>Endpoint</option></select></td><td><div class="range-container"><input type="range" min="0" max="5" value="${asset.importance}" data-key="importance"><span class="range-value">${asset.importance}</span></div></td><td><button class="btn-danger-sm">X</button></td>`;
        tableBody.appendChild(row);
    });
    attachRowEventListeners();
    updateSummaryCards();
}

function addAsset() {
    const newId = assetInventory.length > 0 ? Math.max(...assetInventory.map(a => a.id)) + 1 : 1;
    assetInventory.push({ id: newId, name: 'New Asset', type: 'Server', importance: 3 });
    renderTable();
}

function deleteAsset(id) {
    assetInventory = assetInventory.filter(asset => asset.id !== id);
    renderTable();
}

function updateSummaryCards() {
    document.getElementById('total-assets-summary').textContent = assetInventory.length;
    document.getElementById('high-importance-summary').textContent = assetInventory.filter(a => a.importance > 3).length;
}

function attachRowEventListeners() {
    document.querySelectorAll('#asset-table-body tr').forEach(row => {
        const id = parseInt(row.dataset.id, 10);
        row.querySelectorAll('input[type="text"], select').forEach(input => {
            input.addEventListener('change', (e) => {
                const asset = assetInventory.find(a => a.id === id);
                if (asset) asset[e.target.dataset.key] = e.target.value;
            });
        });
        const rangeInput = row.querySelector('input[type="range"]');
        if(rangeInput) {
            rangeInput.addEventListener('input', (e) => {
                const rangeValueSpan = e.target.nextElementSibling;
                if (rangeValueSpan) rangeValueSpan.textContent = e.target.value;
            });
            rangeInput.addEventListener('change', (e) => {
                const asset = assetInventory.find(a => a.id === id);
                if (asset) {
                    asset.importance = parseInt(e.target.value, 10);
                    updateSummaryCards();
                }
            });
        }
        row.querySelector('.btn-danger-sm')?.addEventListener('click', () => deleteAsset(id));
    });

}

