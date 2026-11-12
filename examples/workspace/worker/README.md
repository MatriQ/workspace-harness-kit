# Greeting Worker

Process one synthetic greeting from standard input with Python 3.9 or later:

```sh
printf '%s\n' '{"message":"Hello, Casey!"}' | python3 consume.py --revision development
```

Expect an accepted receipt containing the greeting and the supplied source revision.
The cross-repository smoke supplies a full Git revision and verifies the receipt.
`--reject` is a deliberate business-failure fixture. No data is persisted.
