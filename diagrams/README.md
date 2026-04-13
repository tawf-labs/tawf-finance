# tawf.finance Diagrams

This directory contains PlantUML diagrams for the tawf.finance ecosystem.

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Investment Flow | `investment-flow.puml` | Sequence diagram showing how capital moves through the ecosystem |
| Trust Architecture | `trust-architecture.puml` | Layered diagram showing the four layers of investor protection |
| Trust Architecture (Component) | `trust-architecture-component.puml` | Component view of trust layers with investor interactions |

## Rendering PlantUML

### Online (Quickest)
Copy and paste the PlantUML code to:
- [PlantText](https://www.planttext.com/)
- [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/)

### VS Code
1. Install the [PlantUML extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml)
2. Open any `.puml` file
3. Press `Alt+D` to render

### CLI
Install PlantUML via Java:
```bash
brew install plantuml  # macOS
# or download plantuml.jar and run:
java -jar plantuml.jar diagram.txt
```

Generate PNG:
```bash
java -jar plantuml.jar investment-flow.puml
```

Generate SVG:
```bash
java -jar plantuml.jar -tsvg investment-flow.puml
```

## Key Insights

### Investment Flow
- Capital flows from: **investor → escrow → business**
- Returns flow from: **retailer → business → escrow → investor**
- The platform creates the digital receipt but never holds funds directly

### Trust Architecture
- **Defense in depth**: 4 independent layers of verification
- No single point of trust failure
- On-chain records provide permanent, auditable trail
- Human elements (cooperative, foundation) balance the technological
