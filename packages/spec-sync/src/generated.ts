export type SpecArtifactId =
  | "aggregateContext"
  | "coreContext"
  | "coreShape"
  | "coreVocabulary"
  | "graphContext"
  | "graphShape"
  | "graphVocabulary";

export interface SpecSyncArtifact {
  id: SpecArtifactId;
  file: string;
  mediaType: string;
  sha256: string;
  size: number;
  url: string;
}

export interface SpecSyncManifest {
  version: 1;
  artifacts: SpecSyncArtifact[];
}

export const GRAPH_CONTEXT_URLS = {
  "aggregate": "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
  "core": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
  "graph": "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld"
} as const;

export const SPEC_SYNC_MANIFEST: SpecSyncManifest = {
  "version": 1,
  "artifacts": [
    {
      "id": "coreVocabulary",
      "file": "artifacts/ed/ns/core.ttl",
      "mediaType": "application/octet-stream",
      "sha256": "2fb6f51d2570f24882de119333a5226fa5c79635c9807eca2d6dc7f88cfc5569",
      "size": 968,
      "url": "https://ujg.specs.openuji.org/ed/ns/core"
    },
    {
      "id": "coreContext",
      "file": "artifacts/ed/ns/core.context.jsonld",
      "mediaType": "application/ld+json",
      "sha256": "a0be08f7ca6d9586bec54323e4bdf19593bd4d4ab7cc61aaf09e641a24d4e16a",
      "size": 470,
      "url": "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld"
    },
    {
      "id": "coreShape",
      "file": "artifacts/ed/ns/core.shape.ttl",
      "mediaType": "application/octet-stream",
      "sha256": "30e505e5915cb08e7dbf2e9b5c62b42e312eef2ba7866678837c38366cfcc26c",
      "size": 1012,
      "url": "https://ujg.specs.openuji.org/ed/ns/core.shape"
    },
    {
      "id": "graphVocabulary",
      "file": "artifacts/ed/ns/graph.ttl",
      "mediaType": "application/octet-stream",
      "sha256": "2b1031407873334f16d67dd88ec10df5c32ef348cc51e09170f211ff28ae2fcd",
      "size": 1988,
      "url": "https://ujg.specs.openuji.org/ed/ns/graph"
    },
    {
      "id": "graphContext",
      "file": "artifacts/ed/ns/graph.context.jsonld",
      "mediaType": "application/ld+json",
      "sha256": "5163b45c38911fa13af535adaddba2a3f726ae069239d771ff3c95e2c38f0ffd",
      "size": 1319,
      "url": "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld"
    },
    {
      "id": "graphShape",
      "file": "artifacts/ed/ns/graph.shape.ttl",
      "mediaType": "application/octet-stream",
      "sha256": "94a9a9de06b89c4de2ca003b87dece2e05d402251a0535cc577da0ca22ec0ceb",
      "size": 3801,
      "url": "https://ujg.specs.openuji.org/ed/ns/graph.shape"
    },
    {
      "id": "aggregateContext",
      "file": "artifacts/ed/ns/context.jsonld",
      "mediaType": "application/ld+json",
      "sha256": "b0581a285b04db7dcecd0661f54164de7ccc9501bec07175386d7a936c623e76",
      "size": 285,
      "url": "https://ujg.specs.openuji.org/ed/ns/context.jsonld"
    }
  ]
};

export const SPEC_SYNC_ARTIFACTS = {
  aggregateContext: {
    url: "https://ujg.specs.openuji.org/ed/ns/context.jsonld",
    content: {
  "@context": [
    "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
    "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld",
    "https://ujg.specs.openuji.org/ed/ns/runtime.context.jsonld",
    "https://ujg.specs.openuji.org/ed/ns/experience.context.jsonld"
  ]
}
  },
  coreContext: {
    url: "https://ujg.specs.openuji.org/ed/ns/core.context.jsonld",
    content: {
  "@context": {
    "@version": 1.1,
    "ujg": "https://ujg.specs.openuji.org/ed/ns/core#",
    "@vocab": "https://ujg.specs.openuji.org/ed/ns/core#",
    "specVersion": "ujg:specVersion",
    "imports": {
      "@id": "ujg:documentImports",
      "@type": "@id",
      "@container": "@set"
    },
    "nodes": {
      "@id": "ujg:documentNodes",
      "@container": "@set"
    },
    "extensions": {
      "@id": "ujg:extensions",
      "@type": "@json"
    }
  }
}
  },
  coreShape: {
    url: "https://ujg.specs.openuji.org/ed/ns/core.shape",
    content: "@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .\n@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix ujgshape: <https://ujg.specs.openuji.org/ed/ns/core.shape#> .\n\n\nujgshape:UJGDocumentShape a sh:NodeShape ;\n  sh:targetClass ujg:UJGDocument ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujg:specVersion ;\n    sh:datatype xsd:string ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n  ] ;\n\n  sh:property [\n    sh:path ujg:documentImports ;\n    sh:nodeKind sh:IRI ;\n    sh:minCount 0 ;\n  ] ;\n\n  sh:property [\n    sh:path ujg:documentNodes ;\n    sh:nodeKind sh:IRI ;\n    sh:minCount 0 ;\n  ] ;\n\n  sh:property [\n    sh:path ujg:extensions ;\n    sh:maxCount 0 ;\n  ] .\n\nujgshape:NodeShape a sh:NodeShape ;\n  sh:targetClass ujg:Node ;\n  sh:targetObjectsOf ujg:documentNodes ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujg:extensions ;\n    sh:datatype rdf:JSON ;\n    sh:maxCount 1 ;\n  ] .\n"
  },
  coreVocabulary: {
    url: "https://ujg.specs.openuji.org/ed/ns/core",
    content: "@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs:<http://www.w3.org/2000/01/rdf-schema#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix dct: <http://purl.org/dc/terms/> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n\n\n<https://ujg.specs.openuji.org/ed/ns/core#> a owl:Ontology ;\n  rdfs:label \"UJG Core Editor's Draft Vocabulary\"@en ;\n  dct:description \"UJG Ontology declaration\" .\n\n### Classes\n\nujg:UJGDocument a owl:Class .\nujg:Node        a owl:Class .\n\nujg:documentImports a owl:ObjectProperty ;\n  rdfs:domain ujg:UJGDocument ; \n  rdfs:range ujg:UJGDocument .\n\nujg:documentNodes a owl:ObjectProperty;\n  rdfs:domain ujg:UJGDocument ; \n  rdfs:range ujg:Node .\n\n### Properties\n\nujg:specVersion a owl:DatatypeProperty ;\n  rdfs:domain ujg:UJGDocument ;\n  rdfs:range xsd:string .\n\nujg:extensions a owl:DatatypeProperty ;\n  rdfs:domain ujg:Node ;\n  rdfs:range rdf:JSON .\n"
  },
  graphContext: {
    url: "https://ujg.specs.openuji.org/ed/ns/graph.context.jsonld",
    content: {
  "@context": {
    "@version": 1.1,
    "ujggraph": "https://ujg.specs.openuji.org/ed/ns/graph#",
    "Journey": "ujggraph:Journey",
    "State": "ujggraph:State",
    "CompositeState": "ujggraph:CompositeState",
    "Transition": "ujggraph:Transition",
    "OutgoingTransition": "ujggraph:OutgoingTransition",
    "OutgoingTransitionGroup": "ujggraph:OutgoingTransitionGroup",
    "label": "ujggraph:label",
    "tags": {
      "@id": "ujggraph:tags",
      "@container": "@set"
    },
    "startState": {
      "@id": "ujggraph:startState",
      "@type": "@id"
    },
    "stateRefs": {
      "@id": "ujggraph:stateRefs",
      "@type": "@id",
      "@container": "@set"
    },
    "transitionRefs": {
      "@id": "ujggraph:transitionRefs",
      "@type": "@id",
      "@container": "@set"
    },
    "outgoingTransitionGroupRefs": {
      "@id": "ujggraph:outgoingTransitionGroupRefs",
      "@type": "@id",
      "@container": "@set"
    },
    "from": {
      "@id": "ujggraph:from",
      "@type": "@id"
    },
    "to": {
      "@id": "ujggraph:to",
      "@type": "@id"
    },
    "subjourneyId": {
      "@id": "ujggraph:subjourneyId",
      "@type": "@id"
    },
    "outgoingTransitionRefs": {
      "@id": "ujggraph:outgoingTransitionRefs",
      "@type": "@id",
      "@container": "@set"
    }
  }
}
  },
  graphShape: {
    url: "https://ujg.specs.openuji.org/ed/ns/graph.shape",
    content: "@prefix ujggraph: <https://ujg.specs.openuji.org/ed/ns/graph#> .\n@prefix sh: <http://www.w3.org/ns/shacl#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix ujggraphshape: <https://ujg.specs.openuji.org/ed/ns/graph.shape#> .\n\n\nujggraphshape:StateLikeShape a sh:NodeShape ;\n  sh:nodeKind sh:IRI ;\n  sh:or (\n    [ sh:class ujggraph:State ]\n    [ sh:class ujggraph:CompositeState ]\n  ) .\n\nujggraphshape:JourneyShape a sh:NodeShape ;\n  sh:targetClass ujggraph:Journey ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:startState ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n    sh:node ujggraphshape:StateLikeShape ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:stateRefs ;\n    sh:minCount 1 ;\n    sh:node ujggraphshape:StateLikeShape ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:transitionRefs ;\n    sh:minCount 1 ;\n    sh:class ujggraph:Transition ;\n    sh:nodeKind sh:IRI ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:outgoingTransitionGroupRefs ;\n    sh:class ujggraph:OutgoingTransitionGroup ;\n    sh:nodeKind sh:IRI ;\n  ] ;\n\n  sh:sparql [\n    a sh:SPARQLConstraint ;\n    sh:message \"A transition in transitionRefs has a from state that is not listed in this journey's stateRefs.\" ;\n    sh:select \"\"\"\n      SELECT $this ?transition ?from\n      WHERE {\n        $this ujggraph:transitionRefs ?transition .\n        ?transition ujggraph:from ?from .\n\n        FILTER (NOT EXISTS {\n          $this ujggraph:stateRefs ?from .\n        })\n      }\n    \"\"\" ;\n  ] ;\n\n  sh:sparql [\n    a sh:SPARQLConstraint ;\n    sh:message \"A transition in transitionRefs has a to state that is not listed in this journey's stateRefs.\" ;\n    sh:select \"\"\"\n      SELECT $this ?transition ?to\n      WHERE {\n        $this ujggraph:transitionRefs ?transition .\n        ?transition ujggraph:to ?to .\n\n        FILTER (NOT EXISTS {\n          $this ujggraph:stateRefs ?to .\n        })\n      }\n    \"\"\" ;\n  ] .\n\nujggraphshape:StateShape a sh:NodeShape ;\n  sh:targetClass ujggraph:State ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:label ;\n    sh:datatype xsd:string ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:tags ;\n    sh:datatype xsd:string ;\n  ] .\n\nujggraphshape:CompositeStateShape a sh:NodeShape ;\n  sh:targetClass ujggraph:CompositeState ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:label ;\n    sh:datatype xsd:string ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:tags ;\n    sh:datatype xsd:string ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:subjourneyId ;\n    sh:class ujggraph:Journey ;\n    sh:nodeKind sh:IRI ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n  ] .\n\nujggraphshape:TransitionShape a sh:NodeShape ;\n  sh:targetClass ujggraph:Transition ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:from ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n    sh:node ujggraphshape:StateLikeShape ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:to ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n    sh:node ujggraphshape:StateLikeShape ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:label ;\n    sh:datatype xsd:string ;\n    sh:maxCount 1 ;\n  ] .\n\nujggraphshape:OutgoingTransitionShape a sh:NodeShape ;\n  sh:targetClass ujggraph:OutgoingTransition ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:to ;\n    sh:minCount 1 ;\n    sh:maxCount 1 ;\n    sh:node ujggraphshape:StateLikeShape ;\n  ] ;\n\n  sh:property [\n    sh:path ujggraph:label ;\n    sh:datatype xsd:string ;\n    sh:maxCount 1 ;\n  ] .\n\nujggraphshape:OutgoingTransitionGroupShape a sh:NodeShape ;\n  sh:targetClass ujggraph:OutgoingTransitionGroup ;\n  sh:nodeKind sh:IRI ;\n\n  sh:property [\n    sh:path ujggraph:outgoingTransitionRefs ;\n    sh:class ujggraph:OutgoingTransition ;\n    sh:nodeKind sh:IRI ;\n    sh:minCount 1 ;\n  ] . \n"
  },
  graphVocabulary: {
    url: "https://ujg.specs.openuji.org/ed/ns/graph",
    content: "@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .\n@prefix ujggraph: <https://ujg.specs.openuji.org/ed/ns/graph#> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n@prefix dct: <http://purl.org/dc/terms/> .\n\n\n<https://ujg.specs.openuji.org/ed/ns/graph#> a owl:Ontology ;\n  rdfs:label \"UJG Graph Editor's Draft Vocabulary\"@en ;\n  dct:description \"UJG Graph ontology declaration\" .\n\n### Classes\n\nujggraph:Journey a owl:Class ;\n  rdfs:subClassOf ujg:Node .\n\nujggraph:State a owl:Class ;\n  rdfs:subClassOf ujg:Node .\n\nujggraph:CompositeState a owl:Class ;\n  rdfs:subClassOf ujggraph:State .\n\nujggraph:Transition a owl:Class ;\n  rdfs:subClassOf ujg:Node .\n\nujggraph:OutgoingTransition a owl:Class ;\n  rdfs:subClassOf ujg:Node .\n\nujggraph:OutgoingTransitionGroup a owl:Class ;\n  rdfs:subClassOf ujg:Node .\n\n### Properties\n\nujggraph:label a owl:DatatypeProperty ;\n  rdfs:domain ujg:Node ;\n  rdfs:range xsd:string .\n\nujggraph:tags a owl:DatatypeProperty ;\n  rdfs:domain ujg:Node ;\n  rdfs:range xsd:string .\n\nujggraph:startState a owl:ObjectProperty ;\n  rdfs:domain ujggraph:Journey ;\n  rdfs:range ujggraph:State .\n\nujggraph:stateRefs a owl:ObjectProperty ;\n  rdfs:range ujggraph:State .\n\nujggraph:transitionRefs a owl:ObjectProperty ;\n  rdfs:domain ujggraph:Journey ;\n  rdfs:range ujggraph:Transition .\n\nujggraph:outgoingTransitionGroupRefs a owl:ObjectProperty ;\n  rdfs:domain ujggraph:Journey ;\n  rdfs:range ujggraph:OutgoingTransitionGroup .\n\nujggraph:from a owl:ObjectProperty ;\n  rdfs:domain ujggraph:Transition ;\n  rdfs:range ujggraph:State .\n\nujggraph:to a owl:ObjectProperty ;\n  rdfs:range ujggraph:State .\n\nujggraph:subjourneyId a owl:ObjectProperty ;\n  rdfs:domain ujggraph:CompositeState ;\n  rdfs:range ujggraph:Journey .\n\nujggraph:outgoingTransitionRefs a owl:ObjectProperty ;\n  rdfs:domain ujggraph:OutgoingTransitionGroup ;\n  rdfs:range ujggraph:OutgoingTransition .\n"
  }
} as const;
