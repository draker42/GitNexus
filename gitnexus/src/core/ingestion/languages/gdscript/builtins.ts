/**
 * GDScript built-in types constants.
 *
 * GDScript code frequently calls methods on built-in Godot types like
 * `Button.new()`, `get_children()`, etc. These types are recognized via
 * `isBuiltInName` but have no corresponding SymbolDefinitions in the
 * user's codebase. This module exports the list of built-in type names
 * for use in the scope resolution pipeline.
 */

/**
 * Common Godot built-in types that frequently appear as receivers
 * in method calls.
 */
export const GODOT_BUILT_IN_TYPES = [
  // Base types
  'Object',
  'Node',
  'Node2D',
  'Node3D',
  'Control',
  'CanvasItem',
  'Spatial',

  // UI Controls
  'Button',
  'Label',
  'LineEdit',
  'TextEdit',
  'TextureRect',
  'Panel',
  'PanelContainer',
  'HBoxContainer',
  'VBoxContainer',
  'GridContainer',
  'CenterContainer',
  'MarginContainer',
  'ScrollContainer',
  'ItemList',
  'Tree',
  'GraphEdit',
  'FileDialog',
  'AcceptDialog',
  'ProgressBar',
  'TextureProgressBar',
  'Slider',
  'SpinBox',
  'CheckBox',
  'OptionButton',
  'Popup',
  'PopupMenu',
  'MenuBar',
  'TabContainer',
  'Tabs',
  'RichTextLabel',
  'Separator',
  'TextureButton',
  'ColorRect',

  // Resources
  'Resource',
  'PackedScene',
  'Script',

  // Display
  'Sprite2D',
  'Sprite3D',
  'Texture',
  'ImageTexture',
  'AnimatedSprite2D',
  'AnimatedSprite3D',
  'AnimationPlayer',
  'AnimationTree',
  'CanvasModulate',

  // Audio
  'AudioStreamPlayer',
  'AudioStreamPlayer2D',
  'AudioStreamPlayer3D',
  'AudioListener2D',
  'AudioListener3D',

  // Input
  'Timer',

  // Geometry
  'Vector2',
  'Vector3',
  'Vector4',
  'Rect2',
  'Transform2D',
  'Transform3D',
  'Plane',
  'AABB',
  'Quaternion',
  'Color',
] as const;

/**
 * Get the set of Godot built-in type names for external use.
 */
export function getGdscriptBuiltInTypeNames(): ReadonlySet<string> {
  return new Set(GODOT_BUILT_IN_TYPES);
}