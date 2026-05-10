import unittest

from app.schemas import PlayerCreate, PlayerUpdate


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


if __name__ == "__main__":
    unittest.main()
