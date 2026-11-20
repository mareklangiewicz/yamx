# YAMX

A family of deliberately constrained YAML profiles for readable data and small,
independent tooling.

## Language

**YAMX**:
The project that defines and supports the YAM(X) family.

**YAM(X)**:
The family of YAML subsets whose profiles select curated bundles of features.

**Profile**:
A specified bundle of accepted syntax and decoded meanings. Profile letters do
not imply inclusion; each specification defines its relationships.

**JSON export**:
One-way conversion of a document accepted by a YAM(X) profile into JSON with the
same decoded data. It does not imply support for JSON input.

## Scalars and resolution (planned; see the scalar-resolution map)

Terms follow the YAML 1.2 spec where it has one, simplified; the YAML term is
noted where ours differs.

**Node**:
One piece of a document's tree: a scalar, a sequence or a mapping.

**Scalar**:
A node holding one piece of text rather than other nodes.

**Scalar style**:
How a scalar is written: plain (bare) or double-quoted. YAML's single-quoted,
literal and folded styles are unsupported constructs.

**Scalar token**:
The exact source text of a scalar, including any quotes and escapes, for
example `true` or `"a\n"`. A scalar that no resolver has interpreted is its
scalar token.
_Avoid_: raw value, untyped string

**Core parser**:
The part of an implementation that accepts a profile's structure and finds
scalar tokens, without giving scalars any meaning.

**Resolver**:
An optional add-on that turns scalar tokens into values and values back into
scalar tokens. YAML calls this a schema performing tag resolution.
_Avoid_: schema, type system

**Raw resolver**:
The resolver whose values are the scalar tokens themselves.

**Typed resolver**:
The resolver that accepts only spellings whose meaning agrees under YAML 1.2's
JSON and Core schemas, and rejects every other spelling.
