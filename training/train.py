#!/usr/bin/env python3
"""
Training Script for Knucklebones Policy-Value Network

This script:
1. Generates self-play games using MCTS
2. Trains the policy-value network on the generated data
3. Exports weights for use in the WASM engine
"""

import argparse
import json
import os
import time
from pathlib import Path
from typing import List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

from game import GameState, Player, get_game_result
from mcts import self_play_game
from network import PolicyValueNetwork, create_network


def generate_training_data(
    network: PolicyValueNetwork,
    num_games: int,
    simulations_per_move: int = 200,
    temperature: float = 1.0,
    show_progress: bool = True,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate training data through self-play.
    
    Returns:
        states: Array of shape (num_samples, 43)
        policies: Array of shape (num_samples, 3)
        values: Array of shape (num_samples,)
    """
    all_states = []
    all_policies = []
    all_values = []
    
    games_iter = range(num_games)
    if show_progress:
        games_iter = tqdm(games_iter, desc="Self-play games")
    
    for _ in games_iter:
        samples = self_play_game(
            network=network,
            simulations=simulations_per_move,
            temperature=temperature,
        )
        
        for state, policy, value in samples:
            all_states.append(state)
            all_policies.append(policy)
            all_values.append(value)
    
    return (
        np.array(all_states, dtype=np.float32),
        np.array(all_policies, dtype=np.float32),
        np.array(all_values, dtype=np.float32),
    )


def train_epoch(
    network: PolicyValueNetwork,
    optimizer: optim.Optimizer,
    dataloader: DataLoader,
    device: torch.device,
) -> Tuple[float, float, float]:
    """
    Train for one epoch.
    
    Returns:
        total_loss, policy_loss, value_loss (averaged over batches)
    """
    network.train()
    
    total_loss_sum = 0.0
    policy_loss_sum = 0.0
    value_loss_sum = 0.0
    num_batches = 0
    
    for states, policies, values in dataloader:
        states = states.to(device)
        policies = policies.to(device)
        values = values.to(device).unsqueeze(1)
        
        optimizer.zero_grad()
        
        # Forward pass
        log_policy, pred_value = network(states)
        
        # Policy loss: cross-entropy (negative log likelihood with soft targets)
        policy_loss = -torch.sum(policies * log_policy, dim=1).mean()
        
        # Value loss: MSE
        value_loss = nn.functional.mse_loss(pred_value, values)
        
        # Total loss
        total_loss = policy_loss + value_loss
        
        # Backward pass
        total_loss.backward()
        optimizer.step()
        
        total_loss_sum += total_loss.item()
        policy_loss_sum += policy_loss.item()
        value_loss_sum += value_loss.item()
        num_batches += 1
    
    return (
        total_loss_sum / num_batches,
        policy_loss_sum / num_batches,
        value_loss_sum / num_batches,
    )


def train(
    network: PolicyValueNetwork,
    num_iterations: int = 10,
    games_per_iteration: int = 100,
    simulations_per_move: int = 200,
    epochs_per_iteration: int = 5,
    batch_size: int = 64,
    learning_rate: float = 0.001,
    output_dir: str = "checkpoints",
    device: torch.device = None,
) -> PolicyValueNetwork:
    """
    Main training loop.
    
    Each iteration:
    1. Generate new self-play games
    2. Train on all accumulated data
    3. Save checkpoint
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    network = network.to(device)
    optimizer = optim.Adam(network.parameters(), lr=learning_rate)
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Accumulated training data
    all_states = []
    all_policies = []
    all_values = []
    
    for iteration in range(num_iterations):
        print(f"\n=== Iteration {iteration + 1}/{num_iterations} ===")
        
        # Generate new games
        print(f"Generating {games_per_iteration} self-play games...")
        start_time = time.time()
        
        states, policies, values = generate_training_data(
            network=network,
            num_games=games_per_iteration,
            simulations_per_move=simulations_per_move,
        )
        
        elapsed = time.time() - start_time
        print(f"Generated {len(states)} samples in {elapsed:.1f}s")
        
        # Add to accumulated data
        all_states.append(states)
        all_policies.append(policies)
        all_values.append(values)
        
        # Create dataset from all accumulated data
        combined_states = np.concatenate(all_states)
        combined_policies = np.concatenate(all_policies)
        combined_values = np.concatenate(all_values)
        
        dataset = TensorDataset(
            torch.from_numpy(combined_states),
            torch.from_numpy(combined_policies),
            torch.from_numpy(combined_values),
        )
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        # Train
        print(f"Training on {len(combined_states)} samples...")
        for epoch in range(epochs_per_iteration):
            total_loss, policy_loss, value_loss = train_epoch(
                network, optimizer, dataloader, device
            )
            print(f"  Epoch {epoch + 1}/{epochs_per_iteration}: "
                  f"loss={total_loss:.4f} (policy={policy_loss:.4f}, value={value_loss:.4f})")
        
        # Save checkpoint
        checkpoint_path = os.path.join(output_dir, f"checkpoint_{iteration + 1}.pt")
        torch.save({
            "iteration": iteration + 1,
            "model_state_dict": network.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
        }, checkpoint_path)
        print(f"Saved checkpoint to {checkpoint_path}")
    
    return network


def export_weights(network: PolicyValueNetwork, output_path: str) -> None:
    """Export network weights to JSON format for WASM loading."""
    weights = network.export_weights()
    
    # Save as JSON
    with open(output_path, "w") as f:
        json.dump(weights.tolist(), f)
    
    print(f"Exported {len(weights)} weights to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Train Knucklebones AI")
    parser.add_argument("--iterations", type=int, default=10, help="Number of training iterations")
    parser.add_argument("--games", type=int, default=100, help="Games per iteration")
    parser.add_argument("--simulations", type=int, default=200, help="MCTS simulations per move")
    parser.add_argument("--epochs", type=int, default=5, help="Training epochs per iteration")
    parser.add_argument("--batch-size", type=int, default=64, help="Training batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--output-dir", type=str, default="checkpoints", help="Output directory")
    parser.add_argument("--export", type=str, default="weights.json", help="Export weights path")
    parser.add_argument("--resume", type=str, default=None, help="Resume from checkpoint")
    
    args = parser.parse_args()
    
    # Create or load network
    network = create_network()
    
    if args.resume:
        print(f"Resuming from {args.resume}")
        checkpoint = torch.load(args.resume)
        network.load_state_dict(checkpoint["model_state_dict"])
    
    # Train
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    network = train(
        network=network,
        num_iterations=args.iterations,
        games_per_iteration=args.games,
        simulations_per_move=args.simulations,
        epochs_per_iteration=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        output_dir=args.output_dir,
        device=device,
    )
    
    # Export weights
    export_path = os.path.join(args.output_dir, args.export)
    export_weights(network, export_path)
    
    print("\nTraining complete!")


if __name__ == "__main__":
    main()
