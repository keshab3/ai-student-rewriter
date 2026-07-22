package edu.kcg.rewriting_tool.dto

import java.time.LocalDateTime

data class ContactMessageResponse(
    val id: Long,
    val name: String,
    val email: String,
    val subject: String,
    val message: String,
    val createdAt: LocalDateTime,
)
