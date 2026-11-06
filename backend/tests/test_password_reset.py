"""
Tests for temporary password and password reset functionality
"""
import pytest
from bson import ObjectId
from datetime import datetime
from app.core.security import get_password_hash, verify_password, generate_temporary_password, validate_password_strength


class TestPasswordGeneration:
    """Test temporary password generation"""

    def test_generate_temporary_password(self):
        """Test that temporary passwords are generated"""
        pwd1 = generate_temporary_password()
        pwd2 = generate_temporary_password()
        
        assert len(pwd1) == 12
        assert len(pwd2) == 12
        assert pwd1 != pwd2  # Should be random

    def test_temporary_password_length(self):
        """Test custom password length"""
        pwd = generate_temporary_password(length=16)
        assert len(pwd) == 16


class TestPasswordValidation:
    """Test password strength validation"""

    def test_strong_password(self):
        """Test validation of strong password"""
        strong_pwd = "SecurePass123!@#"
        is_strong, msg = validate_password_strength(strong_pwd)
        assert is_strong
        assert msg == ""

    def test_weak_password_too_short(self):
        """Test password that's too short"""
        short_pwd = "Pass1!"
        is_strong, msg = validate_password_strength(short_pwd)
        assert not is_strong
        assert "8 characters" in msg

    def test_weak_password_no_uppercase(self):
        """Test password without uppercase"""
        no_upper = "password123!@#"
        is_strong, msg = validate_password_strength(no_upper)
        assert not is_strong
        assert "uppercase" in msg

    def test_weak_password_no_lowercase(self):
        """Test password without lowercase"""
        no_lower = "PASSWORD123!@#"
        is_strong, msg = validate_password_strength(no_lower)
        assert not is_strong
        assert "lowercase" in msg

    def test_weak_password_no_digit(self):
        """Test password without digit"""
        no_digit = "Password!@#$%^"
        is_strong, msg = validate_password_strength(no_digit)
        assert not is_strong
        assert "digit" in msg

    def test_weak_password_no_special_char(self):
        """Test password without special character"""
        no_special = "Password1234"
        is_strong, msg = validate_password_strength(no_special)
        assert not is_strong
        assert "special character" in msg


class TestPasswordHashing:
    """Test password hashing and verification"""

    def test_password_hashing(self):
        """Test that passwords are hashed correctly"""
        plain_pwd = "TestPassword123!@#"
        hashed = get_password_hash(plain_pwd)
        
        assert hashed != plain_pwd
        assert verify_password(plain_pwd, hashed)

    def test_password_verification_fails_with_wrong_password(self):
        """Test that verification fails with wrong password"""
        plain_pwd = "TestPassword123!@#"
        wrong_pwd = "WrongPassword123!@#"
        hashed = get_password_hash(plain_pwd)
        
        assert not verify_password(wrong_pwd, hashed)

    def test_hashed_passwords_are_different(self):
        """Test that same password produces different hashes"""
        plain_pwd = "TestPassword123!@#"
        hash1 = get_password_hash(plain_pwd)
        hash2 = get_password_hash(plain_pwd)
        
        assert hash1 != hash2
        assert verify_password(plain_pwd, hash1)
        assert verify_password(plain_pwd, hash2)


@pytest.mark.asyncio
class TestAuthenticationFlow:
    """Test authentication endpoints with temporary passwords"""

    async def test_user_creation_with_temp_password(self, client, admin_headers, db):
        """Test admin creating user with temporary password"""
        # Create user with temp password
        response = await client.post(
            "/api/admin/users/create-with-temp-password",
            json={
                "name": "Test User",
                "email": "test@example.com",
                "role": "mentor",
                "location": "New York",
                "timezone": "EST",
            },
            headers=admin_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["tempPassword"]
        assert data["userId"]
        assert data["email"] == "test@example.com"

        # Verify user in DB has temporary password flag
        user = await db.users.find_one({"email": "test@example.com"})
        assert user
        assert user["firstLoginPasswordReset"]
        assert user["temporaryPassword"]

    async def test_login_with_temp_password_check(self, client, db):
        """Test login check for temporary password"""
        # Create user with temp password
        temp_pwd = generate_temporary_password()
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "role": "mentor",
            "passwordHash": get_password_hash(temp_pwd),
            "temporaryPassword": temp_pwd,
            "firstLoginPasswordReset": True,
            "isActive": True,
            "createdAt": datetime.utcnow(),
        }
        result = await db.users.insert_one(user_data)

        # Check first-time login
        response = await client.post(
            "/api/auth/login-first-time",
            json={
                "email": "test@example.com",
                "password": temp_pwd,
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["requiresPasswordReset"]

    async def test_reset_temporary_password(self, client, db):
        """Test resetting temporary password on first login"""
        # Create user with temp password
        temp_pwd = generate_temporary_password()
        new_pwd = "SecureNewPass123!@#"
        
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "role": "mentor",
            "passwordHash": get_password_hash(temp_pwd),
            "temporaryPassword": temp_pwd,
            "firstLoginPasswordReset": True,
            "isActive": True,
            "createdAt": datetime.utcnow(),
        }
        result = await db.users.insert_one(user_data)

        # Reset temporary password
        response = await client.post(
            "/api/auth/reset-temporary-password",
            json={
                "tempPassword": temp_pwd,
                "newPassword": new_pwd,
                "confirmPassword": new_pwd,
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["access_token"]
        assert data["userId"]

        # Verify user in DB no longer has temp password flag
        user = await db.users.find_one({"email": "test@example.com"})
        assert not user["firstLoginPasswordReset"]
        assert not user["temporaryPassword"]
        assert verify_password(new_pwd, user["passwordHash"])

    async def test_reset_password_with_mismatched_passwords(self, client, db):
        """Test password reset fails with mismatched passwords"""
        temp_pwd = generate_temporary_password()
        
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "role": "mentor",
            "passwordHash": get_password_hash(temp_pwd),
            "temporaryPassword": temp_pwd,
            "firstLoginPasswordReset": True,
            "isActive": True,
            "createdAt": datetime.utcnow(),
        }
        await db.users.insert_one(user_data)

        response = await client.post(
            "/api/auth/reset-temporary-password",
            json={
                "tempPassword": temp_pwd,
                "newPassword": "SecurePass123!@#",
                "confirmPassword": "DifferentPass123!@#",
            }
        )

        assert response.status_code == 400
        assert "do not match" in response.json()["detail"]

    async def test_reset_password_with_weak_password(self, client, db):
        """Test password reset fails with weak password"""
        temp_pwd = generate_temporary_password()
        
        user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "role": "mentor",
            "passwordHash": get_password_hash(temp_pwd),
            "temporaryPassword": temp_pwd,
            "firstLoginPasswordReset": True,
            "isActive": True,
            "createdAt": datetime.utcnow(),
        }
        await db.users.insert_one(user_data)

        response = await client.post(
            "/api/auth/reset-temporary-password",
            json={
                "tempPassword": temp_pwd,
                "newPassword": "weak",
                "confirmPassword": "weak",
            }
        )

        assert response.status_code == 400
        assert "too weak" in response.json()["detail"].lower()

    async def test_change_password_after_login(self, client, authenticated_user_headers, db):
        """Test changing password after successful login"""
        old_pwd = "OldPassword123!@#"
        new_pwd = "NewPassword456!@#"
        
        # User already created and authenticated via fixture
        response = await client.post(
            "/api/auth/change-password",
            json={
                "currentPassword": old_pwd,
                "newPassword": new_pwd,
                "confirmPassword": new_pwd,
            },
            headers=authenticated_user_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"]
