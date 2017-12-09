#!/bin/bash
mkdir -p data data-nasa
mkdir -p public/predictions public-nasa
STAT=$(stat -t data)
python ftpfetch.py
if [[ $STAT != $(stat -t data) ]]; then
    python parsehdf5.py
    if [[ -e .train.pid ]]; then
        kill $(cat .train.pid)
        rm .train.pid
    fi
    nohup ./train.sh & > /dev/null
    echo $! > .train.pid
fi
