export interface SampleDraft {
  id: string;
  name: string;
  text: string;
}

const SAMPLE_DOCUMENTS = [
  {
    name: "main-site.json",
    value: {
      type: "UJGDocument",
      specVersion: "1.0",
      items: [
        {
          type: "Journey",
          id: "urn:ujg:journey:main-site",
          startState: "urn:ujg:state:home",
          stateRefs: ["urn:ujg:state:home", "urn:ujg:state:checkout-flow"],
          transitionRefs: [
            "urn:ujg:transition:home-to-checkout",
            "urn:ujg:transition:checkout-to-profile"
          ],
          outgoingTransitionGroupRefs: ["urn:ujg:otg:global-header"]
        },
        {
          type: "Transition",
          id: "urn:ujg:transition:home-to-checkout",
          from: "urn:ujg:state:home",
          to: { id: "urn:ujg:state:checkout-flow", type: "CompositeState" },
          label: "Buy Now"
        },
        {
          type: "Transition",
          id: "urn:ujg:transition:checkout-to-profile",
          from: "urn:ujg:state:checkout-flow",
          to: "urn:ujg:state:profile",
          label: "Profile"
        },
        {
          type: "State",
          id: "urn:ujg:state:home",
          label: "Home Page",
          tags: ["phase:landing"]
        },
        {
          type: "CompositeState",
          id: "urn:ujg:state:checkout-flow",
          label: "Checkout Process",
          tags: ["phase:checkout"],
          subjourneyId: "urn:ujg:journey:checkout"
        },
        {
          type: "State",
          id: "urn:ujg:state:profile",
          label: "Profile"
        },
        {
          type: "OutgoingTransition",
          id: "urn:ujg:ot:go-home",
          to: "urn:ujg:state:home",
          label: "Home"
        },
        {
          type: "OutgoingTransition",
          id: "urn:ujg:ot:go-profile",
          to: "urn:ujg:state:profile",
          label: "Profile"
        },
        {
          type: "OutgoingTransitionGroup",
          id: "urn:ujg:otg:global-header",
          outgoingTransitionRefs: ["urn:ujg:ot:go-home", "urn:ujg:ot:go-profile"]
        }
      ]
    }
  },
  {
    name: "checkout.json",
    value: {
      type: "UJGDocument",
      specVersion: "1.0",
      items: [
        {
          type: "Journey",
          id: "urn:ujg:journey:checkout",
          startState: "urn:ujg:state:shipping",
          stateRefs: ["urn:ujg:state:shipping", "urn:ujg:state:payment"],
          transitionRefs: ["urn:ujg:transition:shipping-to-payment"]
        },
        {
          type: "State",
          id: "urn:ujg:state:shipping",
          label: "Shipping",
          tags: ["phase:checkout"]
        },
        {
          type: "State",
          id: "urn:ujg:state:payment",
          label: "Payment",
          tags: ["phase:checkout"]
        },
        {
          type: "Transition",
          id: "urn:ujg:transition:shipping-to-payment",
          from: "urn:ujg:state:shipping",
          to: "urn:ujg:state:payment",
          label: "Continue"
        }
      ]
    }
  }
];

export function createSampleDrafts(): SampleDraft[] {
  return SAMPLE_DOCUMENTS.map((document, index) => ({
    id: `sample-${index + 1}`,
    name: document.name,
    text: JSON.stringify(document.value, null, 2)
  }));
}
