package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.ApiErrorResponse
import edu.kcg.rewriting_tool.service.RewriteNotFoundException
import edu.kcg.rewriting_tool.service.RewriteModeUnavailableException
import edu.kcg.rewriting_tool.service.TextUploadException
import edu.kcg.rewriting_tool.service.UserAccountNotFoundException
import edu.kcg.rewriting_tool.service.UsernameAlreadyExistsException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(error: MethodArgumentNotValidException): ResponseEntity<ApiErrorResponse> {
        val message = error.bindingResult.fieldErrors
            .joinToString(" ") { it.defaultMessage ?: "${it.field} is invalid." }
            .ifBlank { "Request validation failed." }

        return apiError(HttpStatus.BAD_REQUEST, message)
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadableRequest(error: HttpMessageNotReadableException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.BAD_REQUEST, "Request body is invalid. Check the selected rewrite mode and JSON format.")

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun handleTypeMismatch(error: MethodArgumentTypeMismatchException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.BAD_REQUEST, "Request path contains an invalid value.")

    @ExceptionHandler(RewriteModeUnavailableException::class)
    fun handleUnavailableMode(error: RewriteModeUnavailableException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.BAD_REQUEST, error.message ?: "This rewrite mode is unavailable.")

    @ExceptionHandler(RewriteNotFoundException::class)
    fun handleNotFound(error: RewriteNotFoundException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.NOT_FOUND, error.message ?: "Rewrite history item was not found.")

    @ExceptionHandler(UserAccountNotFoundException::class)
    fun handleUserNotFound(error: UserAccountNotFoundException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.NOT_FOUND, error.message ?: "User account was not found.")

    @ExceptionHandler(TextUploadException::class)
    fun handleTextUpload(error: TextUploadException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.BAD_REQUEST, error.message ?: "Could not read the uploaded file.")

    @ExceptionHandler(UsernameAlreadyExistsException::class)
    fun handleUsernameExists(error: UsernameAlreadyExistsException): ResponseEntity<ApiErrorResponse> =
        apiError(HttpStatus.CONFLICT, error.message ?: "Username is already registered.")

    private fun apiError(status: HttpStatus, message: String): ResponseEntity<ApiErrorResponse> =
        ResponseEntity.status(status).body(
            ApiErrorResponse(
                status = status.value(),
                error = status.reasonPhrase,
                message = message,
            ),
        )
}
