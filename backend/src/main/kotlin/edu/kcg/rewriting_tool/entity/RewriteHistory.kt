package edu.kcg.rewriting_tool.entity

import edu.kcg.rewriting_tool.dto.RewriteMode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "rewrite_history")
class RewriteHistory(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "original_text", nullable = false, columnDefinition = "LONGTEXT")
    var originalText: String = "",

    @Column(name = "rewritten_text", nullable = false, columnDefinition = "LONGTEXT")
    var rewrittenText: String = "",

    @Column(name = "vocabulary_suggestions", columnDefinition = "TEXT")
    var vocabularySuggestionsJson: String = "{}",

    @Column(name = "avoid_words", columnDefinition = "TEXT")
    var avoidWordsJson: String = "[]",

    @Column(name = "evaluation", columnDefinition = "TEXT")
    var evaluationJson: String = "null",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    var mode: RewriteMode = RewriteMode.GRAMMAR_FIX,

    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    var owner: UserAccount? = null,
)
