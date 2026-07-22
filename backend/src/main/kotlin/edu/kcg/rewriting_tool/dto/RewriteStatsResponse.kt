package edu.kcg.rewriting_tool.dto

data class RewriteStatsResponse(
    val totalRewrites: Long,
    val recentRewrites: List<RewriteResponse>,
)
