# Injection Context

Use the narrowest injection context that works.

| Context   | Use When                                                    |
| --------- | ----------------------------------------------------------- |
| `auto`    | Default choice for normal DOM scripts                       |
| `content` | DOM access without page JavaScript globals                  |
| `page`    | Direct access to page-defined JavaScript values is required |

Prefer `CustomEvent` or `postMessage` bridges over broad global exposure. Do not expose debug bridges in release builds.
