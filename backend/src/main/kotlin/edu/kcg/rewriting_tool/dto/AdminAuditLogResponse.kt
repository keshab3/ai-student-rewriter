package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class AdminAuditLogResponse(
    val id: Long,
    val actorUsername: String?,
    val action: String,
    val details: String,
    val createdAt: LocalDateTime,
)
