/**
 * Default SQL Server query. The three runtime variables are injected by the
 * backend from the MPG and period controls before execution.
 */
export const DEFAULT_SQL_QUERY = `WITH BaseData AS (
    SELECT
        a.[Periode],
        c.MPG,
        c.WCTR,
        c.Nama,
        c.NPK,
        c.lokasi,
        c.penempatan,
        c.Jabatan,
        b.ScoringName,
        a.[Achievement],
        d.TargetValue,
        b.Weighted,
        a.[AchRatio],
        a.[5Scale],
        a.[SubTotal]
    FROM [DesSy].[dbo].[SCORING-CE_ScoringResult] a
    LEFT JOIN [SCORING-CE_ItemScoring] b ON a.ItemID = b.ItemID
    LEFT JOIN [SCORING-CE_ManPower] c ON a.ManPowerID = c.ManPowerID
    LEFT JOIN [SCORING-CE_TargetScoring] d ON a.TargetID = d.TargetID
    WHERE a.Periode BETWEEN @PeriodeStart AND @PeriodeEnd
      AND (@MPG = 'all' OR c.MPG = @MPG)
      AND c.MPG <> ''
)
SELECT
    Periode,
    a.MPG,
    a.WCTR,
    a.Nama,
    a.NPK,
    lokasi AS Lokasi,
    penempatan AS Loc,
    a.Jabatan,

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan = 'CSM' THEN Achievement END) AS [Achievement_MoP_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan = 'CSM' THEN Achievement END) AS [Achievement_CostPerRevenue_CSM],
    MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN Achievement END) AS [Achievement_CSAT_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN Achievement END) AS [Achievement_LWH_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN Achievement END) AS [Achievement_RTSuccessRatio_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN Achievement END) AS [Achievement_LoL_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN Achievement END) AS [Achievement_ReturnCons_CSM],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan IN ('CE', 'SPS') THEN Achievement END) AS [Achievement_MoP_CE],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan IN ('CE', 'SPS') THEN Achievement END) AS [Achievement_CostPerRevenue_CE],
    MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN Achievement END) AS [Achievement_RTFirstVisit_CE],
    MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN Achievement END) AS [Achievement_WkTS_CE],
    MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN Achievement END) AS [Achievement_TSM_CE],
    MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN Achievement END) AS [Achievement_ProductivityCall_CE],
    MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN Achievement END) AS [Achievement_SupportIT_CE],
    MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN Achievement END) AS [Achievement_CEComSkill_CE],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan = 'CSM' THEN TargetValue END) AS [Target_MoP_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan = 'CSM' THEN TargetValue END) AS [Target_CostPerRevenue_CSM],
    MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN TargetValue END) AS [Target_CSAT_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN TargetValue END) AS [Target_LWH_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN TargetValue END) AS [Target_RTSuccessRatio_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN TargetValue END) AS [Target_LoL_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN TargetValue END) AS [Target_ReturnCons_CSM],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan IN ('CE', 'SPS') THEN TargetValue END) AS [Target_MoP_CE],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan IN ('CE', 'SPS') THEN TargetValue END) AS [Target_CostPerRevenue_CE],
    MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN TargetValue END) AS [Target_RTFirstVisit_CE],
    MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN TargetValue END) AS [Target_WkTS_CE],
    MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN TargetValue END) AS [Target_TSM_CE],
    MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN TargetValue END) AS [Target_ProductivityCall_CE],
    MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN TargetValue END) AS [Target_SupportIT_CE],
    MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN TargetValue END) AS [Target_CEComSkill_CE],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan = 'CSM' THEN Weighted END) AS [Weighted_MoP_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan = 'CSM' THEN Weighted END) AS [Weighted_CostPerRevenue_CSM],
    MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN Weighted END) AS [Weighted_CSAT_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN Weighted END) AS [Weighted_LWH_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN Weighted END) AS [Weighted_RTSuccessRatio_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN Weighted END) AS [Weighted_LoL_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN Weighted END) AS [Weighted_ReturnCons_CSM],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan IN ('CE', 'SPS') THEN Weighted END) AS [Weighted_MoP_CE],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan IN ('CE', 'SPS') THEN Weighted END) AS [Weighted_CostPerRevenue_CE],
    MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN Weighted END) AS [Weighted_RTFirstVisit_CE],
    MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN Weighted END) AS [Weighted_WkTS_CE],
    MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN Weighted END) AS [Weighted_TSM_CE],
    MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN Weighted END) AS [Weighted_ProductivityCall_CE],
    MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN Weighted END) AS [Weighted_SupportIT_CE],
    MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN Weighted END) AS [Weighted_CEComSkill_CE],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan = 'CSM' THEN [5Scale] END) AS [5Scale_MoP_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan = 'CSM' THEN [5Scale] END) AS [5Scale_CostPerRevenue_CSM],
    MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN [5Scale] END) AS [5Scale_CSAT_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN [5Scale] END) AS [5Scale_LWH_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN [5Scale] END) AS [5Scale_RTSuccessRatio_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN [5Scale] END) AS [5Scale_LoL_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN [5Scale] END) AS [5Scale_ReturnCons_CSM],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan IN ('CE', 'SPS') THEN [5Scale] END) AS [5Scale_MoP_CE],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan IN ('CE', 'SPS') THEN [5Scale] END) AS [5Scale_CostPerRevenue_CE],
    MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN [5Scale] END) AS [5Scale_RTFirstVisit_CE],
    MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN [5Scale] END) AS [5Scale_WkTS_CE],
    MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN [5Scale] END) AS [5Scale_TSM_CE],
    MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN [5Scale] END) AS [5Scale_ProductivityCall_CE],
    MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN [5Scale] END) AS [5Scale_SupportIT_CE],
    MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN [5Scale] END) AS [5Scale_CEComSkill_CE],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan = 'CSM' THEN SubTotal END) AS [SubTotal_MoP_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan = 'CSM' THEN SubTotal END) AS [SubTotal_CostPerRevenue_CSM],
    MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN SubTotal END) AS [SubTotal_CSAT_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN SubTotal END) AS [SubTotal_LWH_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN SubTotal END) AS [SubTotal_RTSuccessRatio_CSM],
    MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN SubTotal END) AS [SubTotal_LoL_CSM],
    MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN SubTotal END) AS [SubTotal_ReturnCons_CSM],

    MAX(CASE WHEN ScoringName LIKE 'MoP%' AND a.Jabatan IN ('CE', 'SPS') THEN SubTotal END) AS [SubTotal_MoP_CE],
    MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND a.Jabatan IN ('CE', 'SPS') THEN SubTotal END) AS [SubTotal_CostPerRevenue_CE],
    MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN SubTotal END) AS [SubTotal_RTFirstVisit_CE],
    MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN SubTotal END) AS [SubTotal_WkTS_CE],
    MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN SubTotal END) AS [SubTotal_TSM_CE],
    MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN SubTotal END) AS [SubTotal_ProductivityCall_CE],
    MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN SubTotal END) AS [SubTotal_SupportIT_CE],
    MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN SubTotal END) AS [SubTotal_CEComSkill_CE],

    CEILING((
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'MoP%' AND c.Jabatan = 'CSM' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND c.Jabatan = 'CSM' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'CSAT%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'LWH%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Response Time Success%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'LoL%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Return Cons%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'MoP%' AND c.Jabatan IN ('CE', 'SPS') THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Cost Cons per Revenue%' AND c.Jabatan IN ('CE', 'SPS') THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'RT FirstVisit%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Working Time%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'TSM%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Productivity Call%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE 'Support IT%' THEN SubTotal END), 0) +
      COALESCE(MAX(CASE WHEN ScoringName LIKE '%Communication Skill%' THEN SubTotal END), 0)
    ) * 10) / 10.0 AS TOTAL,

    c.MPG AS [MPG_SaatIni],
    c.WCTR AS [WcTr_SaatIni],
    c.Jabatan AS [Posisi_SaatIni]
FROM BaseData a
LEFT JOIN (
    SELECT NPK, Nama, MPG, WCTR, Jabatan
    FROM [SCORING-CE_ManPower]
    WHERE Periode = @PeriodeEnd
) c ON a.NPK = c.NPK
GROUP BY
    Periode,
    a.MPG,
    a.WCTR,
    a.Nama,
    a.NPK,
    lokasi,
    penempatan,
    a.Jabatan,
    c.MPG,
    c.WCTR,
    c.Jabatan
ORDER BY Periode, MPG, WCTR, Nama;`;
