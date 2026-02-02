import os
import logging
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Configure logging
logger = logging.getLogger(__name__)

# Environment Configuration
CLERK_ISSUER = os.getenv("CLERK_ISSUER")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

# Determine JWKS URL
if CLERK_JWKS_URL:
    JWKS_URL = CLERK_JWKS_URL
elif CLERK_ISSUER:
    JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"
else:
    JWKS_URL = None
    # We log a warning but don't crash at module level to allow app startup without env vars (e.g. build steps)
    logger.warning("CLERK_ISSUER not set. JWT verification will not work.")

# Initialize JWKS Client
if JWKS_URL:
    jwks_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=300)
else:
    jwks_client = None

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    FastAPI dependency to verify Clerk JWT and return the user_id (sub).

    Validates:
    - Signature (using JWKS)
    - Expiration
    - Issuer

    Returns:
    - user_id (str): The 'sub' claim from the token.

    Raises:
    - HTTPException(401): If token is missing, invalid, expired, or verification fails.
    - HTTPException(500): If server is not configured with Clerk keys.
    """
    if not jwks_client or not CLERK_ISSUER:
        logger.error("JWT verification attempted but CLERK_ISSUER/JWKS_URL is not configured")
        raise HTTPException(
            status_code=500, detail="Server configuration error: Auth not configured"
        )

    token = credentials.credentials

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,
            },
        )

        user_id = payload.get("sub")
        if not user_id:
            logger.warning("Token valid but missing 'sub' claim")
            raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

        return user_id

    except jwt.exceptions.PyJWKClientError as e:
        logger.warning(f"JWKS fetch/key error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    except jwt.ExpiredSignatureError:
        logger.info("Token expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
