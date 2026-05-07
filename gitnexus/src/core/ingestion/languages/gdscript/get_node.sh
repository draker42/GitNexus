#!/bin/sh
NTYPES=node-types.json
[ -z "${@}" ] && { 
  echo "$0 [node]\n\tGet node tree-sitter grammar from $NTYPES\n\tFor a list of nodes: jq .[].type $NTYPES";
  exit;
}
INDEXES=`jq .[].type ${NTYPES} | grep -n "$1" | sed 's/:.*$//'`
[ -n "${INDEXES}" ] || { echo "\"$1\": not found"; exit -1; }
for node in $INDEXES
do
   node=$(( $node - 1 ))
   echo "======= `jq ".[$node].type" ${NTYPES}` ========"
   jq ".[$node].[]" node-types.json || echo "$1: not found"
done
