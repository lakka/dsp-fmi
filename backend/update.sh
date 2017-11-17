#!/bin/bash
mkdir -p data data-nasa
mkdir -p public public-nasa
OLD_STAT=$(stat -t data)
python ftpfetch.py
NEW_STAT=$(stat -t data)
if [[ $OLD_STAT != $NEW_STAT ]]; then
    python parsehdf5.py
    tar cjf public/latest.tar.bz2 public/*.json
fi
