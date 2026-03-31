import assert from "node:assert/strict";
import test from "node:test";

import {
  createGraphIndex,
  materializeJourney,
  validateGraph
} from "../dist/index.js";

const mainDocument = {
  "@context": "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
  "@id": "https://example.com/ujg/graph/main-site.jsonld",
  "@type": "UJGDocument",
  specVersion: "1.0",
  nodes: [
    {
      "@type": "Journey",
      "@id": "urn:ujg:journey:main-site",
      startState: "urn:ujg:state:home",
      stateRefs: ["urn:ujg:state:home", "urn:ujg:state:checkout-flow"],
      transitionRefs: [
        "urn:ujg:transition:home-to-checkout",
        "urn:ujg:transition:checkout-to-profile"
      ],
      outgoingTransitionGroupRefs: ["urn:ujg:otg:global-header"]
    },
    {
      "@type": "Transition",
      "@id": "urn:ujg:transition:home-to-checkout",
      from: "urn:ujg:state:home",
      to: "urn:ujg:state:checkout-flow",
      label: "Buy Now"
    },
    {
      "@type": "Transition",
      "@id": "urn:ujg:transition:checkout-to-profile",
      from: "urn:ujg:state:checkout-flow",
      to: "urn:ujg:state:profile",
      label: "Profile"
    },
    {
      "@type": "State",
      "@id": "urn:ujg:state:home",
      label: "Home Page",
      tags: ["phase:landing"]
    },
    {
      "@type": "CompositeState",
      "@id": "urn:ujg:state:checkout-flow",
      label: "Checkout Process",
      subjourneyId: "urn:ujg:journey:checkout"
    },
    {
      "@type": "State",
      "@id": "urn:ujg:state:profile",
      label: "Profile"
    },
    {
      "@type": "OutgoingTransition",
      "@id": "urn:ujg:ot:go-home",
      to: "urn:ujg:state:home",
      label: "Home"
    },
    {
      "@type": "OutgoingTransition",
      "@id": "urn:ujg:ot:go-profile",
      to: "urn:ujg:state:profile",
      label: "Profile"
    },
    {
      "@type": "OutgoingTransitionGroup",
      "@id": "urn:ujg:otg:global-header",
      outgoingTransitionRefs: ["urn:ujg:ot:go-home", "urn:ujg:ot:go-profile"]
    }
  ]
};

const checkoutDocument = {
  "@context": "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
  "@id": "https://example.com/ujg/graph/checkout.jsonld",
  "@type": "UJGDocument",
  specVersion: "1.0",
  nodes: [
    {
      "@type": "Journey",
      "@id": "urn:ujg:journey:checkout",
      startState: "urn:ujg:state:shipping",
      stateRefs: ["urn:ujg:state:shipping", "urn:ujg:state:payment"],
      transitionRefs: ["urn:ujg:transition:shipping-to-payment"]
    },
    {
      "@type": "State",
      "@id": "urn:ujg:state:shipping",
      label: "Shipping"
    },
    {
      "@type": "State",
      "@id": "urn:ujg:state:payment",
      label: "Payment"
    },
    {
      "@type": "Transition",
      "@id": "urn:ujg:transition:shipping-to-payment",
      from: "urn:ujg:state:shipping",
      to: "urn:ujg:state:payment",
      label: "Continue"
    }
  ]
};

test("validateGraph accepts Graph ED documents that use UJGDocument.nodes", () => {
  const index = createGraphIndex([
    { source: "main-site.jsonld", document: mainDocument },
    { source: "checkout.jsonld", document: checkoutDocument }
  ]);
  const validation = validateGraph(index);

  assert.equal(validation.ok, true);
  assert.equal(index.journeys.size, 2);
  assert.equal(index.compositeStates.size, 1);
  assert.equal(index.outgoingTransitionGroups.size, 1);
});

test("materializeJourney injects outgoing groups and includes referenced states", () => {
  const graph = materializeJourney(
    [
      { source: "main-site.jsonld", document: mainDocument },
      { source: "checkout.jsonld", document: checkoutDocument }
    ],
    "urn:ujg:journey:main-site"
  );

  assert.equal(graph.journey?.id, "urn:ujg:journey:main-site");
  assert.equal(graph.nodes.length, 3);
  assert.equal(
    graph.nodes.find((node) => node.id === "urn:ujg:state:profile")?.membership,
    "referenced"
  );
  assert.equal(
    graph.nodes.find((node) => node.id === "urn:ujg:state:checkout-flow")?.subjourneyId,
    "urn:ujg:journey:checkout"
  );
  assert.equal(graph.edges.length, 5);
  assert.equal(
    graph.edges.find((edge) => edge.id === "urn:ujg:state:checkout-flow::urn:ujg:state:profile")?.kind,
    "mixed"
  );
});

test("validateGraph reports missing references and wrong target types", () => {
  const validation = validateGraph([
    {
      source: "broken.jsonld",
      document: {
        "@type": "UJGDocument",
        nodes: [
          {
            "@type": "Journey",
            "@id": "urn:ujg:journey:broken",
            startState: "urn:ujg:state:missing",
            stateRefs: ["urn:ujg:state:home"],
            transitionRefs: ["urn:ujg:transition:not-a-transition"],
            outgoingTransitionGroupRefs: ["urn:ujg:state:home"]
          },
          {
            "@type": "State",
            "@id": "urn:ujg:state:home",
            label: "Home"
          },
          {
            "@type": "Transition",
            "@id": "urn:ujg:transition:not-a-transition",
            from: "urn:ujg:state:home",
            to: "urn:ujg:state:home"
          }
        ]
      }
    }
  ]);

  const codes = new Set(validation.diagnostics.map((diagnostic) => diagnostic.code));

  assert.equal(validation.ok, false);
  assert.ok(codes.has("GRAPH_REFERENCE_MISSING"));
  assert.ok(codes.has("GRAPH_REFERENCE_TYPE"));
});
