
# create liquidity pool from catk:rwn
sifnodecli tx clp create-pool \
 --from akasha \
 --sourceChain ETH \
 --symbol ETH \
 --ticker catk \
 --nativeAmount 500 \
 --externalAmount 500 \
 --yes

# if we don't sleep there are issues
sleep 5

# create liquidity pool from cbtk:rwn
sifnodecli tx clp create-pool \
 --from akasha \
 --sourceChain ETH \
 --symbol ETH \
 --ticker cbtk \
 --nativeAmount 500 \
 --externalAmount 500 \
 --yes

# should now be able to swap from catk:cbtk