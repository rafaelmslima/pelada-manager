from random import Random
import unittest

from app.models import Player
from app.services.team_balancer import (
    calculate_team_score,
    distribute_by_rating,
    generate_balanced_teams,
    improve_position_balance,
)


def make_player(
    player_id: int,
    name: str,
    rating: float,
    position: str = "meio",
) -> Player:
    return Player(id=player_id, name=name, rating=rating, position=position, is_active=True)


def player_names(team) -> set[str]:
    return {player.name for player in team.players}


class TeamBalancerTest(unittest.TestCase):
    def test_generates_two_full_teams_and_splits_top_rated_players(self):
        players = [
            make_player(index, f"Jogador {index}", rating)
            for index, rating in enumerate(
                [5, 4.9, 4.5, 4.4, 4.1, 4, 3.8, 3.6, 3.4, 3.2],
                start=1,
            )
        ]

        teams, reserves = generate_balanced_teams(players, players_per_team=5, rng=Random(1))

        self.assertEqual(len(teams), 2)
        self.assertEqual(reserves, [])
        self.assertEqual([len(team.players) for team in teams], [5, 5])
        self.assertPlayersUsedOnce(teams, players)
        self.assertNotEqual(
            _team_index_with_player(teams, "Jogador 1"),
            _team_index_with_player(teams, "Jogador 2"),
        )

    def test_generates_three_teams_with_close_total_ratings(self):
        players = [
            make_player(index, f"Jogador {index}", rating)
            for index, rating in enumerate(
                [5, 5, 4.5, 4.5, 4, 4, 3.8, 3.8, 3.5, 3.5, 3, 3, 2.8, 2.8, 2.5],
                start=1,
            )
        ]

        teams, reserves = generate_balanced_teams(players, players_per_team=5, rng=Random(2))
        totals = [team.total_rating for team in teams]

        self.assertEqual(len(teams), 3)
        self.assertEqual(reserves, [])
        self.assertEqual([len(team.players) for team in teams], [5, 5, 5])
        self.assertPlayersUsedOnce(teams, players)
        self.assertLessEqual(max(totals) - min(totals), 1.0)

    def test_creates_incomplete_team_when_count_does_not_close(self):
        players = [
            make_player(index, f"Jogador {index}", rating)
            for index, rating in enumerate(
                [5, 4.9, 4.7, 4.5, 4.3, 4.1, 3.9, 3.7, 3.5, 3.3, 3.1, 2.9, 2.7, 2.5, 2.3, 1.2],
                start=1,
            )
        ]

        teams, reserves = generate_balanced_teams(players, players_per_team=5, rng=Random(3))

        self.assertEqual(len(teams), 4)
        self.assertEqual(reserves, [])
        # Todos os times têm a mesma capacidade-alvo (cheia); apenas o último
        # fica com menos jogadores, a serem completados durante a pelada.
        self.assertEqual([team.capacity for team in teams], [5, 5, 5, 5])
        self.assertEqual([len(team.players) for team in teams], [5, 5, 5, 1])
        self.assertEqual([team.missing_players for team in teams], [0, 0, 0, 4])
        self.assertPlayersUsedOnce(teams, players)

    def test_incomplete_team_is_not_stuffed_with_top_players(self):
        ratings = [5.0, 4.8, 4.6, 4.4, 4.2, 4.0, 3.8, 3.6, 3.4, 3.2, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0]
        players = [
            make_player(index, f"Jogador {index}", rating)
            for index, rating in enumerate(ratings, start=1)
        ]
        highest_rating = max(ratings)

        for seed in range(20):
            teams, _ = generate_balanced_teams(players, players_per_team=5, rng=Random(seed))

            self.assertEqual([len(team.players) for team in teams], [5, 5, 5, 1])
            full_teams = teams[:3]
            incomplete_team = teams[3]
            max_full_average = max(team.average_rating for team in full_teams)

            # O time incompleto não deve ser equiparado em força aos cheios à
            # custa de craques: sua média não pode estourar a do time cheio mais
            # forte, e ele não deve ficar com o jogador de maior rating de todos.
            self.assertLessEqual(incomplete_team.average_rating, max_full_average + 0.3)
            self.assertNotEqual(incomplete_team.players[0].rating, highest_rating)

    def test_generates_different_balanced_teams_across_attempts(self):
        players = [
            make_player(index, f"Jogador {index}", rating, position)
            for index, (rating, position) in enumerate(
                [
                    (5, "defesa"),
                    (4.9, "meio"),
                    (4.8, "ataque"),
                    (4.7, "defesa"),
                    (4.5, "meio"),
                    (4.4, "ataque"),
                    (4.2, "defesa"),
                    (4.1, "meio"),
                    (4, "ataque"),
                    (3.9, "defesa"),
                    (3.7, "meio"),
                    (3.6, "ataque"),
                ],
                start=1,
            )
        ]

        generated_signatures = {
            _team_signature(generate_balanced_teams(players, players_per_team=4, rng=Random(seed))[0])
            for seed in range(12)
        }

        self.assertGreater(len(generated_signatures), 1)

    def test_snake_draft_spreads_best_players_across_teams(self):
        players = [
            make_player(1, "Jogador A", 5),
            make_player(2, "Jogador B", 5),
            make_player(3, "Jogador C", 4.5),
            make_player(4, "Jogador D", 4.5),
            make_player(5, "Jogador E", 4),
            make_player(6, "Jogador F", 4),
        ]

        teams = distribute_by_rating(players, number_of_teams=3, players_per_team=2)

        self.assertEqual(player_names(teams[0]), {"Jogador A", "Jogador F"})
        self.assertEqual(player_names(teams[1]), {"Jogador B", "Jogador E"})
        self.assertEqual(player_names(teams[2]), {"Jogador C", "Jogador D"})

    def test_position_balance_avoids_swaps_that_create_large_rating_gap(self):
        teams = distribute_by_rating(
            [
                make_player(1, "Defesa 1", 5, "defesa"),
                make_player(2, "Defesa 2", 4.9, "defesa"),
                make_player(3, "Ataque 1", 4.8, "ataque"),
                make_player(4, "Ataque 2", 4.7, "ataque"),
                make_player(5, "Meio 1", 2, "meio"),
                make_player(6, "Meio 2", 1.9, "meio"),
            ],
            number_of_teams=2,
            players_per_team=3,
        )
        initial_gap = _rating_gap(teams)

        improve_position_balance(teams)

        self.assertLessEqual(_rating_gap(teams), initial_gap + 0.5)

    def test_calculates_team_score(self):
        team = [
            make_player(1, "Jogador A", 4.25),
            make_player(2, "Jogador B", 3.75),
        ]

        self.assertEqual(calculate_team_score(team), 8.0)

    def assertPlayersUsedOnce(self, teams, players):
        expected_ids = sorted(player.id for player in players)
        actual_ids = sorted(player.id for team in teams for player in team.players)
        self.assertEqual(actual_ids, expected_ids)


def _team_index_with_player(teams, player_name: str) -> int:
    for index, team in enumerate(teams):
        if any(player.name == player_name for player in team.players):
            return index
    raise AssertionError(f"Jogador nao encontrado: {player_name}")


def _rating_gap(teams) -> float:
    totals = [team.total_rating for team in teams]
    return max(totals) - min(totals)


def _team_signature(teams) -> tuple[tuple[str, ...], ...]:
    return tuple(sorted(tuple(sorted(player.name for player in team.players)) for team in teams))


if __name__ == "__main__":
    unittest.main()
