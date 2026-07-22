package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.Role
import org.springframework.data.jpa.repository.JpaRepository

interface RoleRepository : JpaRepository<Role, Long> {
    fun findByName(name: String): Role?
}
