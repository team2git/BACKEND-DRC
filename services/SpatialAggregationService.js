/**
 * SpatialAggregationService.js
 * Implements the 5-layer spatial aggregation logic:
 * House -> Block -> Woreda -> Sub-city -> City
 */

// Helper to compute DR Risk Score
export const computeRiskScore = (h, e, v, c) => {
    const cap = c > 0 ? c : 1;
    const score = (h * e * v) / cap;
    return Math.round(score * 10) / 10;
};

// Woreda Level: Hazard Index H = AVERAGE(top 3 weighted hazard scores)
export const calculateHazardIndex = (hazards = []) => {
    // Weighted score per hazard is typically frequency * severity
    const scores = hazards.map(h => {
        const freqMap = { 'Daily': 5, 'Weekly': 4, 'Monthly': 3, 'Yearly': 2, 'Rarely': 1 };
        const sevMap = { 'Catastrophic': 5, 'Major': 4, 'Moderate': 3, 'Minor': 2, 'Insignificant': 1 };
        const f = freqMap[h.frequency] || (parseInt(h.frequency) || 1);
        const s = sevMap[h.severity] || (parseInt(h.severity) || 1);
        return f * s;
    }).sort((a, b) => b - a);
    
    const top3 = scores.slice(0, 3);
    return top3.length > 0 ? top3.reduce((a, b) => a + b, 0) / top3.length : 0;
};

// Woreda Level: Exposure Index E = (E_pop * 0.6) + (E_infra * 0.4)
export const calculateExposureIndex = (demographics = {}, facilities = [], infrastructure = {}) => {
    // Simplified proxy for E_pop and E_infra based on available data
    const e_pop = demographics.total_population > 1000 ? 5 : (demographics.total_population / 200) || 1;
    const e_infra = facilities.length > 5 ? 5 : (facilities.length || 1);

    const infraMeasures = Object.values(infrastructure || {}).filter(v => typeof v === 'string' && v.trim().length > 0).length;
    const infraScore = infraMeasures > 0 ? Math.min(5, infraMeasures) : 1;

    return (e_pop * 0.4) + (e_infra * 0.3) + (infraScore * 0.3);
};

// Woreda Level: Vulnerability Index V = (V_soc * 0.30) + (V_phy * 0.30) + (V_eco * 0.25) + (V_env * 0.15)
export const calculateVulnerabilityIndex = (woredaData = {}) => {
    // V_soc: Social (Poverty, Female headed, Disabled, etc.)
    const v_soc = (woredaData.demographics?.low_income_households > 20 ? 5 : 3);
    
    // V_phy: Physical (Building age, material, proximity)
    const v_phy = (woredaData.housing_indicators?.percent_non_durable_materials > 30 ? 5 : 2);
    
    // V_eco: Economic (Unemployment, Livelihood disruption)
    const v_eco = (woredaData.demographics?.unemployment_rate > 15 ? 4 : 2);
    
    // V_env: Environmental (Green space, waste, drainage)
    const v_env = (woredaData.environmental_indicators?.urban_drainage_blockage_frequency === 'High' ? 5 : 2);

    return (v_soc * 0.30) + (v_phy * 0.30) + (v_eco * 0.25) + (v_env * 0.15);
};

// Woreda Level: Capacity Index C
export const calculateCapacityIndex = (capacityData = []) => {
    // Simple average of available capacities
    if (!capacityData || capacityData.length === 0) return 1;
    const availableCount = capacityData.filter(c => c.available).length;
    return (availableCount / capacityData.length) * 5 || 1;
};

export const aggregateHouseToBlock = (households) => {
    const totalHH = households.length;
    if (totalHH === 0) return null;

    const totalPop = households.reduce((sum, hh) => sum + (hh.demographics?.total_household_members || 0), 0);
    const informalHH = households.filter(hh => hh.housing_physical_conditions?.informal_settlement === 'Yes').length;
    const hazardExposedHH = households.filter(hh => hh.housing_physical_conditions?.proximity_to_hazard_zone === 'Yes').length;
    
    // Using resilience_enumerator_assessment_1_5 as V_score proxy if available, otherwise 1
    const totalVScore = households.reduce((sum, hh) => sum + (hh.recovery_capacity?.resilience_enumerator_assessment_1_5 || 1), 0);

    return {
        total_population: totalPop,
        percent_informal_housing: (informalHH / totalHH) * 100,
        percent_hazard_exposed: (hazardExposedHH / totalHH) * 100,
        avg_vulnerability_score: totalVScore / totalHH,
        total_households: totalHH
    };
};

export const aggregateBlockToWoreda = (blocks) => {
    const totalHH = blocks.reduce((sum, b) => sum + (b.total_households || 0), 0);
    if (totalHH === 0) return null;

    const totalPop = blocks.reduce((sum, b) => sum + (b.total_population || 0), 0);
    
    // Poverty rate %: aggregated from household level counts if available in blocks
    const povertyHH = blocks.reduce((sum, b) => sum + (b.low_income_households || 0), 0);

    return {
        total_population: totalPop,
        total_households: totalHH,
        poverty_rate: (povertyHH / totalHH) * 100,
    };
};

export const aggregateWoredaToSubcity = (woredas) => {
    if (woredas.length === 0) return null;

    const totalPop = woredas.reduce((sum, w) => sum + (w.total_population || 0), 0);
    
    // Avg risk score: AVERAGE(DR_woreda) weighted by woreda population
    const weightedDRSum = woredas.reduce((sum, w) => sum + ((w.risk_index?.overall_woreda_risk_score || 0) * (w.total_population || 0)), 0);
    const avgRiskScore = totalPop > 0 ? weightedDRSum / totalPop : 0;

    // % woredas high/very high risk: COUNT(DR >= 16) / COUNT(all woredas) * 100
    const highRiskWoredas = woredas.filter(w => (w.risk_index?.overall_woreda_risk_score || 0) >= 16).length;
    const percentHighRisk = (highRiskWoredas / woredas.length) * 100;

    return {
        total_population: totalPop,
        avg_risk_score: avgRiskScore,
        percent_high_risk: percentHighRisk
    };
};

export const aggregateSubcityToCity = (woredas) => {
    if (woredas.length === 0) return null;

    // City risk distribution: COUNT(DR by level: Low/Med/High/VH) across all woredas
    const distribution = { Low: 0, Medium: 0, High: 0, VeryHigh: 0 };
    woredas.forEach(w => {
        const dr = w.risk_index?.overall_woreda_risk_score || 0;
        if (dr < 8) distribution.Low++;
        else if (dr < 16) distribution.Medium++;
        else if (dr < 24) distribution.High++;
        else distribution.VeryHigh++;
    });

    // City-wide avg capacity: AVERAGE(C_woreda) across all woredas
    const totalCapacity = woredas.reduce((sum, w) => sum + (w.risk_index?.capacity_index || 0), 0);
    const avgCapacity = woredas.length > 0 ? totalCapacity / woredas.length : 0;

    // City hazard heatmap: COUNT(woreda where H_hazard_type >= 3) per hazard type
    // Hazard prevalence: we'll check if hazard_index is high or specific hazards are high
    const hazardHeatmap = {};
    woredas.forEach(w => {
        (w.hazards || []).forEach(h => {
            // If the specific hazard severity is high (e.g. >= 3/5)
            const sevMap = { 'Catastrophic': 5, 'Major': 4, 'Moderate': 3, 'Minor': 2, 'Insignificant': 1 };
            const s = sevMap[h.severity] || (parseInt(h.severity) || 1);
            if (s >= 3) {
                hazardHeatmap[h.hazard_name] = (hazardHeatmap[h.hazard_name] || 0) + 1;
            }
        });
    });

    return {
        risk_distribution: distribution,
        avg_capacity: avgCapacity,
        hazard_heatmap: hazardHeatmap
    };
};
