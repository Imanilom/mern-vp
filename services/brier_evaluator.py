# services/brier_evaluator.py
"""
Evaluasi Brier Score dan Brier Skill Score untuk CAPAR Markov Prediction.

Spesifikasi Multiclass Brier Score untuk 5 State CAPAR:
    BS_raw = (1/N) * sum_i sum_k (p_ik - y_ik)^2   (rentang 0..2)
    BS_normalized = BS_raw / 2                     (rentang 0..1)
    BSS = 1 - (BS_model / BS_reference)
"""

from typing import List, Dict
import numpy as np


STATES = [
    "BASELINE_COMPATIBLE",
    "DEVIATION_CANDIDATE",
    "PERSISTENT_DEVIATION",
    "RECOVERY_START",
    "RECOVERED",
]


class BrierEvaluator:
    """
    Evaluasi probabilistic prediction CAPAR.

    Multiclass Brier Score:
        BS = (1/N) * sum_i sum_k (p_ik - y_ik)^2

    Raw multiclass range: 0..2
    Normalized Brier = raw / 2, range 0..1

    Semakin kecil semakin baik.
    """

    def __init__(self, states=None):
        self.states = states or STATES

    def _validate_probabilities(
        self,
        probabilities: Dict[str, float]
    ):
        missing = [
            state
            for state in self.states
            if state not in probabilities
        ]

        if missing:
            raise ValueError(
                f"Missing states: {missing}"
            )

        values = np.array(
            [probabilities[state] for state in self.states],
            dtype=float
        )

        if np.any(values < 0):
            raise ValueError(
                "Probability cannot be negative."
            )

        total = values.sum()

        if not np.isclose(total, 1.0, atol=1e-4):
            raise ValueError(
                f"Probabilities must sum to 1. "
                f"Current sum = {total}"
            )

    def score_single(
        self,
        probabilities: Dict[str, float],
        actual_state: str
    ) -> Dict:
        self._validate_probabilities(probabilities)

        if actual_state not in self.states:
            raise ValueError(
                f"Unknown actual state: {actual_state}"
            )

        squared_errors = {}
        total_score = 0.0

        for state in self.states:
            predicted = probabilities[state]
            actual = 1.0 if state == actual_state else 0.0
            error = (predicted - actual) ** 2
            squared_errors[state] = error
            total_score += error

        normalized_score = total_score / 2.0

        predicted_state = max(
            probabilities,
            key=probabilities.get
        )

        confidence = probabilities[predicted_state]

        return {
            "actual_state": actual_state,
            "predicted_state": predicted_state,
            "confidence": round(confidence, 6),
            "correct": predicted_state == actual_state,
            "brier_score_raw": round(total_score, 6),
            "brier_score_normalized": round(normalized_score, 6),
            "state_squared_errors": {
                state: round(value, 6)
                for state, value in squared_errors.items()
            }
        }

    def evaluate(
        self,
        records: List[Dict],
        reference_brier: float = 0.20
    ) -> Dict:
        if len(records) == 0:
            return {
                "status": "NO_DATA",
                "n": 0
            }

        raw_scores = []
        normalized_scores = []
        correct_count = 0

        per_state_errors = {
            state: []
            for state in self.states
        }

        details = []

        for record in records:
            result = self.score_single(
                probabilities=record["probabilities"],
                actual_state=record["actual_state"]
            )

            raw_scores.append(result["brier_score_raw"])
            normalized_scores.append(result["brier_score_normalized"])

            if result["correct"]:
                correct_count += 1

            for state in self.states:
                per_state_errors[state].append(
                    result["state_squared_errors"][state]
                )

            details.append(result)

        mean_raw = float(np.mean(raw_scores))
        mean_normalized = float(np.mean(normalized_scores))
        accuracy = correct_count / len(records)

        state_brier = {
            state: round(
                float(np.mean(per_state_errors[state])),
                6
            )
            for state in self.states
        }

        # Brier Skill Score: BSS = 1 - (BS_model / BS_reference)
        bss = round(1.0 - (mean_raw / reference_brier), 6) if reference_brier > 0 else 0.0

        return {
            "status": "READY",
            "n_predictions": len(records),
            "brier_score_raw": round(mean_raw, 6),
            "brier_score_normalized": round(mean_normalized, 6),
            "brier_skill_score": bss,
            "top1_accuracy": round(accuracy, 6),
            "per_state_brier": state_brier,
            "details": details
        }


def brier_skill_score(
    model_brier: float,
    reference_brier: float
) -> float:
    """
    Hitung Brier Skill Score (BSS).
    BSS = 1 - (BS_model / BS_reference)
    """
    if reference_brier <= 0:
        raise ValueError("Reference Brier Score must be > 0")

    return 1.0 - (model_brier / reference_brier)
