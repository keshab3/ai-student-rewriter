package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.RewriteHistory
import edu.kcg.rewriting_tool.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface RewriteHistoryRepository : JpaRepository<RewriteHistory, Long> {
    fun findAllByOrderByCreatedAtDesc(): List<RewriteHistory>
    fun findAllByOwnerOrderByCreatedAtDesc(owner: UserAccount): List<RewriteHistory>
    fun findByIdAndOwner(id: Long, owner: UserAccount): Optional<RewriteHistory>
    fun existsByIdAndOwner(id: Long, owner: UserAccount): Boolean
    fun countByOwner(owner: UserAccount): Long
}
