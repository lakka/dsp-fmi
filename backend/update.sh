#!/bin/bash
mkdir -p data data-nasa
mkdir -p public/predictions public-nasa
STAT=$(stat -t data)
python ftpfetch.py
if [[ $STAT != $(stat -t data) ]]; then
    python parsehdf5.py
    nice -n 19 python traingaussian.py -p
fi
