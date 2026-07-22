package edu.kcg.rewriting_tool.entity

import edu.kcg.rewriting_tool.dto.RewriteMode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.LocalDateTime

@Entity
@Table(
    name = "user_prompt_settings",
    uniqueConstraints = [UniqueConstraint(name = "uk_user_prompt_settings_owner_mode", columnNames = ["owner_id", "mode"])],
)
class UserPromptSetting(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    var owner: UserAccount? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    var mode: RewriteMode = RewriteMode.GRAMMAR_FIX,

    @Column(name = "prompt_instruction", columnDefinition = "TEXT")
    var promptInstruction: String? = null,

    @Column(name = "output_instruction", columnDefinition = "TEXT")
    var outputInstruction: String? = null,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
)
