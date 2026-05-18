import unittest

from pydantic import ValidationError

from app.schemas import AuthLoginRequest, PlayerCreate, PlayerUpdate


class PlayerManagementTest(unittest.TestCase):
    def test_player_create_uses_management_defaults(self):
        player = PlayerCreate(name="Rafael", position="meio", rating=4)
        self.assertEqual(player.billing_type, "diarista")
        self.assertFalse(player.has_paid)
        self.assertEqual(player.whatsapp, "")

    def test_player_update_accepts_management_fields(self):
        player = PlayerUpdate(
            name="Rafael",
            position="ataque",
            rating=4.5,
            billing_type="mensalista",
            has_paid=True,
            whatsapp="11999999999",
            is_active=True,
        )
        self.assertEqual(player.billing_type, "mensalista")
        self.assertTrue(player.has_paid)
        self.assertEqual(player.whatsapp, "11999999999")

    def test_auth_email_uses_real_email_validation(self):
        with self.assertRaises(ValidationError):
            AuthLoginRequest(email="rafael@", password="senha")

        payload = AuthLoginRequest(email="Rafael@example.com", password="senha")
        self.assertEqual(payload.email, "rafael@example.com")


if __name__ == "__main__":
    unittest.main()
