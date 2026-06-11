# Product

## Register

product

## Users
Power users, developers, marketers, SREs, and creators who need a highly reliable, focused utility tool to automate bulk-submitting prompt queues to web-based AI assistants (Gemini and ChatGPT). They typically have multiple prompts stored in Google Sheets and need to execute them sequentially while monitoring the queue status and progress without losing track of their workflow.

## Product Purpose
The extension reads prompt lists from Google Sheets and sequentially submits them to active Gemini or ChatGPT browser tabs. It coordinates the execution queue, monitors completion states, applies delays, and reports progress. Success is a clean, reliable, and background-resilient prompter that fits perfectly alongside standard developer tools, with zero clutter.

## Brand Personality
Utilitarian, precise, focused. It should look like a developer tool or SRE panel (similar to Linear or Raycast). The design should be clean, highly organized, and structured. It should feel robust, technical, and trustworthy.

## Anti-references
- Glassmorphism used as a default overlay.
- Side-stripe borders and colored highlight accents on cards.
- Gradient text or background-clip text combinations.
- Heavy neon-colored glow effects.
- Complex layout grids or modular card systems.

## Design Principles
1. **Focus on the Queue**: The user's goal is to load and run prompts. The configuration controls and active queue state should be the core layout elements.
2. **Context-Aware Visual Cues**: Subtle, semantic accents change between Gemini's Violet and ChatGPT's Green to indicate the active target AI immediately, without being loud.
3. **Robust Component States**: Every button, input, and state indicator must have clear visual differences for focus, hover, disabled, active, and loading states.
4. **Predictable & Restrained Spacing**: Standardize padding, alignments, and sizes to make the panel feel like a native tool.

## Accessibility & Inclusion
- Contrast ratios of at least 4.5:1 for standard text (WCAG AA).
- Clear, high-visibility focus states for keyboard-only navigation.
- Accessible ARIA labels on all control elements and SVG icons.
