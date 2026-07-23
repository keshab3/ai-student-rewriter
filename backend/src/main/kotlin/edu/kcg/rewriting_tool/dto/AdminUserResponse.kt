package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class AdminUserResponse(
    val id: Long,
    val username: String,
    val displayName: String,
    val fullName: String,
    val email: String,
    val roles: List<String>,
    val enabled: Boolean,
    val createdAt: LocalDateTime,
)
