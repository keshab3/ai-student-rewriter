package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.AdminAuditLog
import edu.kcg.rewriting_tool.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminAuditLogRepository : JpaRepository<AdminAuditLog, Long> {
    fun findTop20ByOrderByCreatedAtDesc(): List<AdminAuditLog>

    @Modifying
    @Query("update AdminAuditLog log set log.actor = null where log.actor = :actor")
    fun clearActor(@Param("actor") actor: UserAccount): Int
}
