package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.entity.PromptSetting
import org.springframework.data.jpa.repository.JpaRepository

interface PromptSettingRepository : JpaRepository<PromptSetting, RewriteMode>
