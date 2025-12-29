# ASIO SDK Setup

Download the ASIO SDK from Steinberg and extract it here.

## Steps

1. Go to https://www.steinberg.net/developers/
2. Download "ASIO SDK" (requires free account)
3. Extract the zip file
4. Copy the contents so you have this structure:

```
asio-sdk/
├── README.md (this file)
├── common/
│   ├── asio.cpp
│   ├── asio.h
│   ├── asiodrivers.cpp
│   ├── asiodrivers.h
│   ├── asiodrvr.h
│   ├── asiolist.cpp
│   ├── asiolist.h
│   ├── asiosys.h
│   ├── combase.cpp
│   ├── combase.h
│   ├── dllentry.cpp
│   ├── iasiodrv.h
│   └── register.cpp
└── host/
    ├── asiodrivers.cpp
    ├── asiodrivers.h
    ├── ginclude.h
    ├── pc/
    │   └── asiolist.cpp (and .h)
    └── sample/
        └── hostsample.cpp
```

The key files needed are in `common/` - especially `asio.h` and `iasiodrv.h`.

## After Adding Files

Commit and push. The GitHub Actions workflow will automatically build with ASIO support.
