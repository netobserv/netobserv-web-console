package auth

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
)

func getTokenFromHeader(header http.Header) (string, error) {
	authValue := header.Get(AuthHeader)
	if authValue != "" {
		if !strings.HasPrefix(authValue, "Bearer ") {
			return "", errors.New("missing Bearer token in Authorization header")
		}
		token := strings.TrimSpace(strings.TrimPrefix(authValue, "Bearer "))
		if token == "" {
			return "", errors.New("empty Bearer token in Authorization header")
		}
		return token, nil
	}
	return "", errors.New("missing Authorization header")
}

// Returns the bearer token, and the relevant http code (200 or error)
func RetrieveToken(requestHeader http.Header, forwardUserToken bool, tokenPath string) (string, int, error) {
	if forwardUserToken {
		token, err := getTokenFromHeader(requestHeader)
		if err != nil {
			return "", http.StatusUnauthorized, fmt.Errorf("failed to read bearer token from request: %w", err)
		}
		return token, http.StatusOK, nil
	}
	if tokenPath != "" {
		bytes, err := os.ReadFile(tokenPath)
		if err != nil {
			return "", http.StatusInternalServerError, fmt.Errorf("failed to read authorization token from path '%s': %w", tokenPath, err)
		}
		return string(bytes), http.StatusOK, nil
	}
	return "", http.StatusOK, nil
}
