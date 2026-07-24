from collections import Counter
from dataclasses import dataclass, field
from math import ceil
from random import Random

from app.models import Player


POSITIONS = ("defesa", "meio", "ataque")
POSITION_IMBALANCE_TOLERANCE = 0.5
BALANCED_TEAM_ATTEMPTS = 80
BEST_CANDIDATE_POOL_SIZE = 8


@dataclass
class BalancedTeam:
    name: str
    capacity: int
    players: list[Player] = field(default_factory=list)

    @property
    def total_rating(self) -> float:
        return calculate_team_score(self.players)

    @property
    def average_rating(self) -> float:
        if not self.players:
            return 0
        return round(self.total_rating / len(self.players), 2)

    @property
    def missing_players(self) -> int:
        return max(self.capacity - len(self.players), 0)

    @property
    def is_full(self) -> bool:
        return len(self.players) >= self.capacity

    def position_count(self, position: str) -> int:
        return sum(1 for player in self.players if player.position == position)


def sort_players_by_rating(players: list[Player]) -> list[Player]:
    return sorted(players, key=lambda player: (-player.rating, player.name))


def select_players_for_teams(
    players: list[Player],
    players_per_team: int,
) -> tuple[list[Player], list[Player], int]:
    if players_per_team < 1:
        raise ValueError("A quantidade de jogadores por time deve ser maior que zero.")

    sorted_players = sort_players_by_rating(players)
    number_of_teams = ceil(len(sorted_players) / players_per_team) if sorted_players else 0

    return sorted_players, [], number_of_teams


def distribute_by_rating(
    players: list[Player],
    number_of_teams: int,
    players_per_team: int | None = None,
) -> list[BalancedTeam]:
    if number_of_teams < 1:
        return []

    capacity = players_per_team or _max_team_size(len(players), number_of_teams)
    teams = _create_teams(number_of_teams, capacity)

    draft_order = _snake_draft_order(number_of_teams)
    order_index = 0
    for player in sort_players_by_rating(players):
        team = _next_available_team(teams, draft_order, order_index)
        if team is None:
            break

        team_index = teams.index(team)
        team.players.append(player)
        order_index = _next_order_index(draft_order, order_index, team_index)

    return teams


def improve_position_balance(teams: list[BalancedTeam]) -> list[BalancedTeam]:
    if len(teams) < 2:
        return teams

    max_iterations = 100
    for _ in range(max_iterations):
        current_position_score = _position_score(teams)
        current_rating_gap = _average_rating_gap(teams)
        best_swap: tuple[BalancedTeam, Player, BalancedTeam, Player] | None = None
        best_position_score = current_position_score
        best_rating_gap = current_rating_gap

        for first_index, first_team in enumerate(teams):
            for second_team in teams[first_index + 1 :]:
                for first_player in first_team.players:
                    for second_player in second_team.players:
                        if first_player.position == second_player.position:
                            continue

                        _swap_players(first_team, first_player, second_team, second_player)
                        new_position_score = _position_score(teams)
                        new_rating_gap = _average_rating_gap(teams)
                        _swap_players(first_team, second_player, second_team, first_player)

                        if new_rating_gap > current_rating_gap + POSITION_IMBALANCE_TOLERANCE:
                            continue

                        is_better_position = new_position_score < best_position_score
                        is_same_position_better_rating = (
                            new_position_score == best_position_score
                            and new_rating_gap < best_rating_gap
                        )

                        if is_better_position or is_same_position_better_rating:
                            best_swap = (
                                first_team,
                                first_player,
                                second_team,
                                second_player,
                            )
                            best_position_score = new_position_score
                            best_rating_gap = new_rating_gap

        if best_swap is None:
            break

        first_team, first_player, second_team, second_player = best_swap
        _swap_players(first_team, first_player, second_team, second_player)

    return teams


def calculate_team_score(team: list[Player] | BalancedTeam) -> float:
    players = team.players if isinstance(team, BalancedTeam) else team
    return round(sum(player.rating for player in players), 2)


def generate_balanced_teams(
    players: list[Player],
    players_per_team: int,
    rng: Random | None = None,
) -> tuple[list[BalancedTeam], list[Player]]:
    rng = rng or Random()
    selected_players, reserves, number_of_teams = select_players_for_teams(
        players,
        players_per_team,
    )
    if number_of_teams == 0:
        return [], sort_players_by_rating(players)

    candidates = [
        _generate_random_candidate(
            selected_players,
            number_of_teams,
            players_per_team,
            rng,
        )
        for _ in range(BALANCED_TEAM_ATTEMPTS)
    ]
    candidates.sort(key=_team_quality_score)
    best_candidates = candidates[: min(BEST_CANDIDATE_POOL_SIZE, len(candidates))]
    teams = rng.choice(best_candidates)

    return teams, reserves


def _generate_random_candidate(
    players: list[Player],
    number_of_teams: int,
    players_per_team: int,
    rng: Random,
) -> list[BalancedTeam]:
    teams = distribute_by_randomized_rating(
        players,
        number_of_teams,
        players_per_team,
        rng,
    )
    improve_position_balance(teams)
    _sort_players_inside_teams(teams)
    return teams


def distribute_by_randomized_rating(
    players: list[Player],
    number_of_teams: int,
    players_per_team: int,
    rng: Random,
) -> list[BalancedTeam]:
    if number_of_teams < 1:
        return []

    teams = _create_teams(number_of_teams, players_per_team)
    draft_sequence = _randomized_draft_sequence(
        number_of_teams,
        players_per_team,
        len(players),
        rng,
    )

    ordered_players = _randomized_rating_order(players, number_of_teams, rng)
    for team_index, player in zip(draft_sequence, ordered_players):
        teams[team_index].players.append(player)

    return teams


def _randomized_draft_sequence(
    number_of_teams: int,
    players_per_team: int,
    player_count: int,
    rng: Random,
) -> list[int]:
    """Ordem de escolha (índice de time por jogador, do melhor ao pior rating).

    Os times cheios são preenchidos por snake draft. Quando faltam jogadores, o
    último time fica incompleto: suas vagas são inseridas em posições aleatórias
    da sequência, para que ele possa receber jogadores de faixas variadas (e não
    só os de rating mais alto). O equilíbrio por média entre as tentativas é o
    que define a melhor composição.
    """
    remainder = player_count % players_per_team if players_per_team else 0
    full_team_count = number_of_teams if remainder == 0 else number_of_teams - 1

    order = list(range(full_team_count))
    rng.shuffle(order)

    sequence: list[int] = []
    forward = True
    for _ in range(players_per_team):
        sequence.extend(order if forward else list(reversed(order)))
        forward = not forward

    if remainder:
        incomplete_index = number_of_teams - 1
        for _ in range(remainder):
            sequence.insert(rng.randint(0, len(sequence)), incomplete_index)

    return sequence


def _create_teams(
    number_of_teams: int,
    players_per_team: int,
) -> list[BalancedTeam]:
    # Todos os times têm a mesma capacidade-alvo (time cheio). Quando faltam
    # jogadores, o último time fica naturalmente incompleto e será completado
    # durante a pelada pelos jogadores que chegam depois — por isso ele NÃO é
    # equiparado em força total aos times cheios (o que o encheria de craques).
    teams: list[BalancedTeam] = []

    for index in range(number_of_teams):
        teams.append(BalancedTeam(name=f"Time {index + 1}", capacity=players_per_team))

    return teams


def _snake_draft_order(number_of_teams: int) -> list[int]:
    forward = list(range(number_of_teams))
    backward = list(reversed(forward))
    return forward + backward


def _randomized_rating_order(
    players: list[Player],
    number_of_teams: int,
    rng: Random,
) -> list[Player]:
    ordered_players = sort_players_by_rating(players)
    randomized_players: list[Player] = []

    for index in range(0, len(ordered_players), number_of_teams):
        tier = ordered_players[index : index + number_of_teams]
        rng.shuffle(tier)
        randomized_players.extend(tier)

    return randomized_players


def _next_available_team(
    teams: list[BalancedTeam],
    draft_order: list[int],
    order_index: int,
) -> BalancedTeam | None:
    if all(team.is_full for team in teams):
        return None

    for offset in range(len(draft_order)):
        candidate_index = draft_order[(order_index + offset) % len(draft_order)]
        candidate = teams[candidate_index]
        if not candidate.is_full:
            return candidate

    return None


def _next_order_index(
    draft_order: list[int],
    order_index: int,
    selected_team_index: int,
) -> int:
    for offset in range(len(draft_order)):
        candidate_order_index = (order_index + offset) % len(draft_order)
        if draft_order[candidate_order_index] == selected_team_index:
            return (candidate_order_index + 1) % len(draft_order)

    return (order_index + 1) % len(draft_order)


def _max_team_size(player_count: int, number_of_teams: int) -> int:
    return player_count // number_of_teams if player_count else 0


def _average_rating_gap(teams: list[BalancedTeam]) -> float:
    # Compara a média por jogador (não o rating total). Assim o time incompleto
    # não é "compensado" com craques para igualar o somatório dos times cheios:
    # empilhar estrelas elevaria a média dele acima das demais e pioraria o gap.
    averages = [team.average_rating for team in teams if team.players]
    if not averages:
        return 0
    return round(max(averages) - min(averages), 2)


def _position_score(teams: list[BalancedTeam]) -> float:
    expected_counts = _expected_position_counts(teams)
    score = 0.0

    for team in teams:
        for position in POSITIONS:
            score += abs(team.position_count(position) - expected_counts[position])

    return round(score, 4)


def _team_quality_score(teams: list[BalancedTeam]) -> tuple[float, float]:
    return (_average_rating_gap(teams), _position_score(teams))


def _expected_position_counts(teams: list[BalancedTeam]) -> dict[str, float]:
    players = [player for team in teams for player in team.players]
    if not players:
        return {position: 0 for position in POSITIONS}

    counts = Counter(player.position for player in players)
    team_count = len(teams)
    return {position: counts[position] / team_count for position in POSITIONS}


def _swap_players(
    first_team: BalancedTeam,
    first_player: Player,
    second_team: BalancedTeam,
    second_player: Player,
) -> None:
    first_index = first_team.players.index(first_player)
    second_index = second_team.players.index(second_player)
    first_team.players[first_index] = second_player
    second_team.players[second_index] = first_player


def _sort_players_inside_teams(teams: list[BalancedTeam]) -> None:
    position_order = {position: index for index, position in enumerate(POSITIONS)}
    for team in teams:
        team.players.sort(
            key=lambda player: (
                position_order.get(player.position, len(POSITIONS)),
                -player.rating,
                player.name,
            )
        )


# --- Modos de sorteio ---------------------------------------------------------

DRAW_MODES = ("simples", "equilibrado", "posicao", "completo")


def generate_teams(
    players: list[Player],
    players_per_team: int,
    mode: str = "completo",
    rng: Random | None = None,
) -> tuple[list[BalancedTeam], list[Player]]:
    """Gera times conforme o modo de sorteio escolhido.

    - simples: aleatório puro (ignora nota e posição)
    - equilibrado: balanceia pela nota (estrelas), sem otimizar posição
    - posicao: distribui as posições uniformemente, ignora a nota
    - completo: nota + posição (comportamento padrão)
    """
    rng = rng or Random()
    if players_per_team < 1:
        raise ValueError("A quantidade de jogadores por time deve ser maior que zero.")
    if mode == "simples":
        return _generate_simple_teams(players, players_per_team, rng)
    if mode == "equilibrado":
        return _generate_rating_teams(players, players_per_team, rng)
    if mode == "posicao":
        return _generate_position_teams(players, players_per_team, rng)
    return generate_balanced_teams(players, players_per_team, rng)


def _team_count(player_count: int, players_per_team: int) -> int:
    return ceil(player_count / players_per_team) if player_count else 0


def _generate_simple_teams(
    players: list[Player], players_per_team: int, rng: Random
) -> tuple[list[BalancedTeam], list[Player]]:
    number_of_teams = _team_count(len(players), players_per_team)
    if number_of_teams == 0:
        return [], []
    teams = _create_teams(number_of_teams, players_per_team)
    shuffled = list(players)
    rng.shuffle(shuffled)
    draft_sequence = _randomized_draft_sequence(number_of_teams, players_per_team, len(shuffled), rng)
    for team_index, player in zip(draft_sequence, shuffled):
        teams[team_index].players.append(player)
    for team in teams:
        team.players.sort(key=lambda player: player.name)
    return teams, []


def _generate_rating_teams(
    players: list[Player], players_per_team: int, rng: Random
) -> tuple[list[BalancedTeam], list[Player]]:
    selected, reserves, number_of_teams = select_players_for_teams(players, players_per_team)
    if number_of_teams == 0:
        return [], sort_players_by_rating(players)
    candidates: list[list[BalancedTeam]] = []
    for _ in range(BALANCED_TEAM_ATTEMPTS):
        teams = distribute_by_randomized_rating(selected, number_of_teams, players_per_team, rng)
        _sort_players_inside_teams(teams)
        candidates.append(teams)
    candidates.sort(key=_average_rating_gap)
    best_candidates = candidates[: min(BEST_CANDIDATE_POOL_SIZE, len(candidates))]
    return rng.choice(best_candidates), reserves


def _generate_position_teams(
    players: list[Player], players_per_team: int, rng: Random
) -> tuple[list[BalancedTeam], list[Player]]:
    number_of_teams = _team_count(len(players), players_per_team)
    if number_of_teams == 0:
        return [], []
    teams = _create_teams(number_of_teams, players_per_team)

    ordered: list[Player] = []
    for position in POSITIONS:
        group = [player for player in players if player.position == position]
        rng.shuffle(group)
        ordered.extend(group)
    others = [player for player in players if player.position not in POSITIONS]
    rng.shuffle(others)
    ordered.extend(others)

    for player in ordered:
        available = [team for team in teams if not team.is_full]
        if not available:
            break
        # Entra no time com menos jogadores daquela posição (e menor no total, para equilibrar tamanhos).
        team = min(available, key=lambda t: (t.position_count(player.position), len(t.players)))
        team.players.append(player)

    _sort_players_inside_teams(teams)
    return teams, []
