package com.campusconnect.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Short factories for the HTTP errors services throw. */
public final class Errors {

    private Errors() {
    }

    public static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
    }

    public static ResponseStatusException forbidden(String reason) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, reason);
    }

    public static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }

    public static ResponseStatusException conflict(String reason) {
        return new ResponseStatusException(HttpStatus.CONFLICT, reason);
    }

    public static ResponseStatusException unauthorized(String reason) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, reason);
    }

    public static ResponseStatusException tooManyRequests(String reason) {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, reason);
    }

    public static ResponseStatusException unavailable(String reason) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, reason);
    }
}
