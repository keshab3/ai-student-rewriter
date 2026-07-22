package edu.kcg.rewriting_tool.entity

import edu.kcg.rewriting_tool.dto.RewriteMode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "prompt_settings")
class PromptSetting(
    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    var mode: RewriteMode = RewriteMode.GRAMMAR_FIX,

    @Column(nullable = false, length = 120)
    var label: String = "",

    @Column(nullable = false, length = 500)
    var description: String = "",

    @Column(name = "prompt_instruction", nullable = false, columnDefinition = "TEXT")
    var promptInstruction: String = "",

    @Column(name = "output_instruction", columnDefinition = "TEXT")
    var outputInstruction: String? = null,

    @Column(nullable = false)
    var enabled: Boolean = true,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
)
