package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.RewriteMode

class RewriteModeUnavailableException(mode: RewriteMode) :
    RuntimeException("The ${mode.label} mode is currently disabled by the administrator.")
