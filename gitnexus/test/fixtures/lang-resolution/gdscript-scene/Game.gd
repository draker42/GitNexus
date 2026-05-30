extends Node2D
class_name Game

func _ready():
	$Player.take_damage(10)

func start_game():
	$Player.heal(50)
