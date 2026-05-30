extends Node2D
class_name Player

var health = 100

func take_damage(amount):
	health -= amount

func heal(amount):
	health += amount