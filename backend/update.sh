#!/bin/bash
PIDFILE=".update.pid"
if [[ -e $PIDFILE ]]; then
    kill $(cat $PIDFILE)
    rm $PIDFILE
fi
echo $BASHPID > $PIDFILE

function symlinklatest {
    ls -t $1/*.json|head -1|sed 's+.*/++'|xargs -I '{}' ln -fs '{}' $1/latest.json
}

mkdir -p data data-nasa
mkdir -p public/predictions public-nasa
mkdir -p public/logs

STAT=$(stat -t data)
python ftpfetch.py
if [[ $STAT != $(stat -t data) ]]; then
    python parsehdf5.py
    symlinklatest "public"
    nice -n 19 python traingaussian.py -p
    symlinklatest "public/predictions"
fi

rm $PIDFILE
