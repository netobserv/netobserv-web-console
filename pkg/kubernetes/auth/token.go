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
		parts := strings.Split(authValue, "Bearer ")
		if len(parts) != 2 {
			return "", errors.New("missing Bearer token in Authorization header")
		}
		return parts[1], nil
	}
	return "", errors.New("missing Authorization header")
}

func RetrieveToken(requestHeader http.Header, forwardUserToken bool, tokenPath string) (string, error) {
	if forwardUserToken {
		token, err := getTokenFromHeader(requestHeader)
		if err != nil {
			return "", fmt.Errorf("failed to read bearer token from request: %w", err)
		}
		return token, nil
	}
	if tokenPath != "" {
		bytes, err := os.ReadFile(tokenPath)
		if err != nil {
			return "", fmt.Errorf("failed to read authorization token from path '%s': %w", tokenPath, err)
		}
		return string(bytes), nil
	}
	return "", nil
}
