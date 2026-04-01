import assert from "node:assert/strict";
import test from "node:test";

import type { GraphIR } from "@jourg/graph";

import {
  buildRenderableNodes,
  computeDepths,
  getRenderableEntityIndex
} from "../src/flow-model.ts";

const graph: GraphIR = {
  kind: "GraphIR",
  entry: "https://example.com/entry.jsonld",
  specVersion: "1.0",
  warnings: [],
  documents: [],
  entities: {
    journeys: [
      {
        id: "urn:ujg:journey:main",
        type: "Journey",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[0]",
        startState: "urn:ujg:state:start",
        stateRefs: [
          "urn:ujg:state:start",
          "urn:ujg:state:checkout",
          "urn:ujg:state:done"
        ],
        transitionRefs: [
          "urn:ujg:transition:start-to-checkout",
          "urn:ujg:transition:checkout-to-done"
        ],
        outgoingTransitionGroupRefs: []
      }
    ],
    states: [
      {
        id: "urn:ujg:state:start",
        type: "State",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[1]",
        label: "Start",
        tags: ["entry"]
      },
      {
        id: "urn:ujg:state:done",
        type: "State",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[3]",
        label: "Done",
        tags: []
      },
      {
        id: "urn:ujg:state:orphan",
        type: "State",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[4]",
        label: "Orphan",
        tags: []
      }
    ],
    compositeStates: [
      {
        id: "urn:ujg:state:checkout",
        type: "CompositeState",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[2]",
        label: "Checkout",
        tags: ["flow"],
        subjourneyId: "urn:ujg:journey:checkout"
      }
    ],
    transitions: [
      {
        id: "urn:ujg:transition:start-to-checkout",
        type: "Transition",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[5]",
        from: "urn:ujg:state:start",
        to: "urn:ujg:state:checkout",
        label: "Checkout"
      },
      {
        id: "urn:ujg:transition:checkout-to-done",
        type: "Transition",
        source: "https://example.com/entry.jsonld",
        path: "$.nodes[6]",
        from: "urn:ujg:state:checkout",
        to: "urn:ujg:state:done",
        label: "Done"
      }
    ],
    outgoingTransitionGroups: [],
    outgoingTransitions: []
  },
  journeys: [
    {
      id: "urn:ujg:journey:main",
      source: "https://example.com/entry.jsonld",
      startStateId: "urn:ujg:state:start",
      memberStateIds: [
        "urn:ujg:state:start",
        "urn:ujg:state:checkout",
        "urn:ujg:state:done"
      ],
      includedStateIds: [
        "urn:ujg:state:start",
        "urn:ujg:state:checkout",
        "urn:ujg:state:done",
        "urn:ujg:state:orphan"
      ],
      edges: [
        {
          id: "urn:ujg:state:start::urn:ujg:state:checkout",
          from: "urn:ujg:state:start",
          to: "urn:ujg:state:checkout",
          kind: "explicit",
          origins: []
        },
        {
          id: "urn:ujg:state:checkout::urn:ujg:state:done",
          from: "urn:ujg:state:checkout",
          to: "urn:ujg:state:done",
          kind: "explicit",
          origins: []
        }
      ]
    }
  ]
};

test("getRenderableEntityIndex caches by GraphIR object identity", () => {
  const cachedA = getRenderableEntityIndex(graph);
  const cachedB = getRenderableEntityIndex(graph);
  const freshGraph = {
    ...graph,
    entities: {
      ...graph.entities,
      states: [...graph.entities.states]
    }
  } satisfies GraphIR;
  const cachedC = getRenderableEntityIndex(freshGraph);

  assert.equal(cachedA, cachedB);
  assert.notEqual(cachedA, cachedC);
});

test("computeDepths preserves breadth-first layering and assigns fallback depth to disconnected nodes", () => {
  const journey = graph.journeys[0];
  assert.ok(journey);

  const nodes = buildRenderableNodes(graph, journey);
  const depths = computeDepths(nodes, journey);

  assert.equal(depths.get("urn:ujg:state:start"), 0);
  assert.equal(depths.get("urn:ujg:state:checkout"), 1);
  assert.equal(depths.get("urn:ujg:state:done"), 2);
  assert.equal(depths.get("urn:ujg:state:orphan"), 3);
});
