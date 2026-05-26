extends Node
class_name GameState

var level = 1
var score = 0

func next_level():
    level += 1

func add_score(points):
    score += points