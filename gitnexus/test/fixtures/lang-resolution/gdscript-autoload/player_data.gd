extends Node
class_name PlayerData

var health = 100
var score = 0

func take_damage(amount):
    health -= amount

func add_score(points):
    score += points
