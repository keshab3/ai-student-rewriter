package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class UpdatePromptSettingRequest(
    @field:NotBlank(message = "Prompt label is required.")
    @field:Size(max = 120, message = "Prompt label must be 120 characters or fewer.")
    val label: String,

    @field:NotBlank(message = "Prompt description is required.")
    @field:Size(max = 500, message = "Prompt description must be 500 characters or fewer.")
    val description: String,

    @field:NotBlank(message = "Prompt instruction is required.")
    @field:Size(max = 4_000, message = "Prompt instruction must be 4,000 characters or fewer.")
    val promptInstruction: String,

    @field:NotBlank(message = "Output instruction is required.")
    @field:Size(max = 2_000, message = "Output instruction must be 2,000 characters or fewer.")
    val outputInstruction: String,

    val enabled: Boolean = true,
)
