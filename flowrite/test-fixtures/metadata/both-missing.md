---
id: both-missing
title: "Window"
---

`Window` keeps only the most recent events, discarding anything older than the size it was built
with. Where a `Ledger` grows forever, a `Window` has a fixed capacity: recording into a full window
drops the oldest entry to make room.

## Building a window

`Window.of(size)` returns an empty window with room for `size` events. The size is fixed at
construction and there is no way to resize afterwards — build a new window instead.

## Recording

`record` returns a new window with the event appended. When the window is already at capacity, the
event at the front is dropped, so the count never exceeds the size.

## Reading back

`recent` returns the retained events in the order they were recorded, oldest first. An empty window
returns an empty list rather than failing, so a caller never has to check emptiness first.
